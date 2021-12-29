const EventEmitter = require('events')
const rubico = require('rubico')
const WebSocket = require('./WebSocket')
const sha256 = require('./internal/sha256')
const AwsPresignedUrlV4 = require('./internal/AwsPresignedUrlV4')
const Crc32 = require('./internal/Crc32')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

// All prelude components are unsigned, 32-bit integers
const PRELUDE_MEMBER_LENGTH = 4

// The prelude consists of two components
const PRELUDE_LENGTH = PRELUDE_MEMBER_LENGTH * 2

// Checksums are always CRC32 hashes.
const CHECKSUM_LENGTH = 4

// Messages must include a full prelude, a prelude checksum, and a message checksum
const MINIMUM_MESSAGE_LENGTH = PRELUDE_LENGTH + CHECKSUM_LENGTH * 2

/**
 * @name TranscribeStream
 *
 * @synopsis
 * ```coffeescript [specscript]
 * const myTranscribeStream = new TranscribeStream(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   languageCode: string,
 *   mediaEncoding: string,
 *   sampleRate: number,
 *   sessionId?: string,
 *   vocabularyName?: string,
 * })
 *
 * myTranscribeStream.on('transcription', transcriptionHandler (transcription {
 *   Alternatives: Array<{
 *     Items: Array<{
 *       Confidence?: number,
 *       Content: string,
 *       EndTime: number, // seconds
 *       StartTime: number, // seconds
 *       Type: 'pronunciation'|'punctuation',
 *       VocabularyFilterMatch: boolean,
 *     }>,
 *     Transcript: string,
 *   }>,
 *   EndTime: number, // seconds
 *   IsPartial: boolean,
 *   ResultId: string, // uuid
 *   StartTime: number, // seconds
 * })=><>)
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/TranscribeStreaming/latest/dg/websocket.html
 *
 * `languageCode` - `en-AU`, `en-GB`, `en-US`, `es-US`, `fr-CA`, `fr-FR`, `de-DE`, `ja-JP`, `ko-KR`, `pt-BR`, `zh-CN` or `it-IT`.
 *
 * `mediaEncoding` - `pcm`, `ogg-opus`, or `flac`.
 *
 * `sampleRate` - The sample rate of the input audio in Hertz. We suggest that you use 8,000 Hz for low-quality audio and 16,000 Hz (or higher) for high-quality audio. The sample rate must match the sample rate in the audio file.
 *
 * `sessionId` - id for the transcription session. If you don't provide a session ID, Amazon Transcribe generates one for you and returns it in the response.
 *
 * `vocabularyName` - The name of the vocabulary to use when processing the transcription job, if any.
 */
const TranscribeStream = function (options) {
  const {
    accessKeyId,
    secretAccessKey,
    region,
    languageCode,
    mediaEncoding,
    sampleRate,
    sessionId,
    vocabularyName,
  } = options

  const url = AwsPresignedUrlV4({
    accessKeyId,
    secretAccessKey,
    region,
    method: 'GET',
    endpoint: `transcribestreaming.${region}.amazonaws.com:8443`,
    protocol: 'wss',
    canonicalUri: '/stream-transcription-websocket',
    serviceName: 'transcribe',
    payloadHash: sha256(''),
    expires: 300,
    queryParams: {
      'language-code': languageCode,
      'media-encoding': mediaEncoding,
      'sample-rate': sampleRate,
      ...sessionId == null ? {} : { 'session-id': sessionId },
      ...vocabularyName == null ? {} : { 'vocabulary-name': vocabularyName },
    },
  })

  this.websocket = new WebSocket(url)
  this.ready = new Promise(resolve => {
    this.websocket.on('open', resolve)
  })
  this.websocket.on('message', chunk => {
    const { headers, body } = unmarshalMessage(chunk)
    if (body.Transcript.Results.length > 0) {
      if (body.Transcript.Results[0].IsPartial) {
        this.emit('partialTranscription', body.Transcript.Results[0])
      } else {
        this.emit('transcription', body.Transcript.Results[0])
      }
    }
  })

  return this
}

TranscribeStream.prototype = EventEmitter.prototype

/**
 * @name TranscribeStream.prototype.sendAudioChunk
 *
 * @synopsis
 * ```coffeescript [specscript]
 * myTranscribeStream.sendAudioChunk(
 *   chunk Buffer, // chunk is binary and assumed to be properly encoded in the specified mediaEncoding
 * ) -> undefined
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/transcribe/latest/dg/event-stream.html
 * https://github.com/aws-samples/amazon-transcribe-comprehend-medical-twilio/blob/main/lib/transcribe-service.js
 */
TranscribeStream.prototype.sendAudioChunk = function (chunk) {
  const headersBytes = marshalHeaders({
    ':message-type': {
      type: 'string',
      value: 'event',
    },
    ':event-type': {
      type: 'string',
      value: 'AudioEvent',
    },
    ':content-type': {
      type: 'string',
      value: 'application/octet-stream',
    },
    // hey: { type: 'string', value: 'yo' },
  })
  const length = headersBytes.byteLength + chunk.byteLength + 16
  const bytes = new Uint8Array(length)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const checksum = new Crc32()

  view.setUint32(0, length, false)
  view.setUint32(4, headersBytes.byteLength, false)
  view.setUint32(8, checksum.update(bytes.subarray(0, 8)).digest(), false)
  bytes.set(headersBytes, 12)
  bytes.set(chunk, headersBytes.byteLength + 12)
  view.setUint32(
    length - 4,
    checksum.update(bytes.subarray(8, length - 4)).digest(),
    false
  )
  this.websocket.send(bytes)
}

/**
 * @name marshalHeaders
 *
 * @synopsis
 * ```coffeescript [specscript]
 * marshalHeaders(headers Object<
 *   [headerName string]: {
 *     type: 'string',
 *     value: string,
 *   }
 * >) -> headersBytes Uint8Array
 * ```
 */
const marshalHeaders = function (headers) {
  const chunks = []
  for (const headerName in headers) {
    const nameBytes = Buffer.from(headerName, 'utf8')
    const header = headers[headerName]
    chunks.push(Buffer.from([nameBytes.byteLength]))
    chunks.push(nameBytes)
    if (header.type == 'string') {
      chunks.push(marshalStringHeaderValue(header.value))
    } else {
      throw new Error(`Unrecognized header type ${header.type}`)
    }
  }
  const headersBytes = new Uint8Array(
    chunks.reduce((total, bytes) => total + bytes.byteLength, 0),
  )
  let index = 0
  for (const chunk of chunks) {
    headersBytes.set(chunk, index)
    index += chunk.byteLength
  }
  return headersBytes
}

/**
 * @synopsis
 * ```coffeescript [specscript]
 * marshalStringHeaderValue(value string) -> bytes Uint8Array
 * ```
 */
const marshalStringHeaderValue = function (value) {
  const buffer = Buffer.from(value, 'utf8')
  const view = new DataView(new ArrayBuffer(3 + buffer.byteLength))
  view.setUint8(0, 7) // string value type
  view.setUint16(1, buffer.byteLength, false)
  const result = new Uint8Array(view.buffer)
  result.set(buffer, 3)
  return result
}

/**
 * @synopsis
 * ```coffeescript [specscript]
 * unmarshalMessage(chunk ArrayBuffer) -> message {
 *   headers: DataView,
 *   body: Uint8Array,
 * }
 * ```
 */
const unmarshalMessage = function (chunk) {
  const { buffer, byteOffset, byteLength } = chunk
  const view = new DataView(buffer, byteOffset, byteLength)
  const messageLength = view.getUint32(0, false)
  const headerLength = view.getUint32(PRELUDE_MEMBER_LENGTH, false)
  return {
    headers: unmarshalHeaders(new DataView(
      buffer,
      byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH,
      headerLength
    )),
    body: JSON.parse(String.fromCharCode.apply(null, new Uint8Array(
      buffer,
      byteOffset + PRELUDE_LENGTH + CHECKSUM_LENGTH + headerLength,
      messageLength - headerLength - (
        PRELUDE_LENGTH + CHECKSUM_LENGTH + CHECKSUM_LENGTH
      )
    ))),
  }
}

/**
 * @synopsis
 * ```coffeescript [specscript]
 * unmarshalHeaders(headersView DataView) -> headers Object
 * ```
 */
const unmarshalHeaders = function (headersView) {
  const headers = {}
  let index = 0
  while (index < headersView.byteLength) {
    const nameLength = headersView.getUint8(index)
    index += 1
    const name = String.fromCharCode.apply(null, new Uint8Array(
      headersView.buffer,
      headersView.byteOffset + index,
      nameLength,
    ))
    index += nameLength
    index += 1 // byte for header type, assumed to be all strings for now
    const stringLength = headersView.getUint16(index, false)
    index += 2
    headers[name] = String.fromCharCode.apply(null, new Uint8Array(
      headersView.buffer,
      headersView.byteOffset + index,
      stringLength,
    ))
    index += stringLength
  }
  return headers
}

module.exports = TranscribeStream
