require('rubico/global')
const EventEmitter = require('events')
const crypto = require('crypto')
const WebSocket = require('./WebSocket')
const AwsPresignedUrlV4 = require('./internal/AwsPresignedUrlV4')
const CRC32 = require('./internal/CRC32')

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
 * @docs
 * ```coffeescript [specscript]
 * new TranscribeStream(options {
 *   languageCode: string,
 *   mediaEncoding: string,
 *   sampleRate: number,
 *   sessionId: string,
 *   vocabularyName: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }) -> transcribeStream TranscribeStream
 * ```
 *
 * Presidium TranscribeStream client for [AWS Transcribe streaming](https://docs.aws.amazon.com/transcribe/latest/dg/streaming.html).
 *
 * Arguments:
 *   * `options`
 *     * `languageCode` - `en-AU`, `en-GB`, `en-US`, `es-US`, `fr-CA`, `fr-FR`, `de-DE`, `ja-JP`, `ko-KR`, `pt-BR`, `zh-CN` or `it-IT`.
 *     *`mediaEncoding` - `pcm`, `ogg-opus`, or `flac`.
 *     * `sampleRate` - The sample rate of the input audio in Hertz. We suggest that you use 8,000 Hz for low-quality audio and 16,000 Hz (or higher) for high-quality audio. The sample rate must match the sample rate in the audio file.
 *     * `sessionId` - id for the transcription session. If you don't provide a session ID, Amazon Transcribe generates one for you and returns it in the response.
 *     * `vocabularyName` - The name of the vocabulary to use when processing the transcription job, if any.
 *     * `accessKeyId` - the AWS access key ID retrieved from the credentials file.
 *     * `secretAccessKey` - the AWS secret access key retrieved from the credentials.
 *     * `region` - the AWS region.
 *
 * Return:
 *   * `transcribeStream` - a TranscribeStream instance.
 *
 * ```javascript
 * const awsCreds = await AwsCredentials('my_profile')
 * awsCreds.region = 'us-east-1'
 *
 * const myTranscribeStream = new TranscribeStream({
 *   languageCode: 'en-US',
 *   mediaEncoding: 'pcm',
 *   sampleRate: 8000,
 *   ...awsCreds,
 * })
 * ```
 */
class TranscribeStream extends EventEmitter {
  constructor(options) {
    super()
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
      payloadHash: crypto.createHash('sha256').update('', 'utf8').digest('hex'),
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

    /**
     * @name ready
     *
     * @docs
     * ```coffeescript [specscript]
     * ready -> promise Promise<>
     * ```
     *
     * The ready promise for the TranscribeStream instance. Resolves when the underlying WebSocket connection to AWS Transcribe streaming is open.
     *
     * ```javascript
     * const awsCreds = await AwsCredentials('default')
     * awsCreds.region = 'us-east-1'
     *
     * const myTranscribeStream = new TranscribeStream({
     *   languageCode: 'en-US',
     *   mediaEncoding: 'pcm',
     *   sampleRate: 8000,
     *   ...awsCreds,
     * })
     * await myTranscribeStream.ready
     * ```
     */
    this.ready = new Promise(resolve => {
      this.websocket.on('open', resolve)
    })
    this.websocket.on('message', chunk => {
      const { headers, body } = unmarshalMessage(chunk)
      if (headers[':message-type'] == 'exception') {
        const error = new Error(body.Message)
        error.name = headers[':exception-type']
        this.emit('error', error)
      }
      else if (body.Transcript.Results.length > 0) {
        if (body.Transcript.Results[0].IsPartial) {
          this.emit('partialTranscription', body.Transcript.Results[0])
        } else {
          this.emit('transcription', body.Transcript.Results[0])
        }
      }
    })
  }


  /**
   * @name Event: transcription
   *
   * @docs
   * ```coffeescript [specscript]
   * module AWSTranscribeStreamingDocs 'https://docs.aws.amazon.com/transcribe/latest/APIReference/API_Types.html'
   *
   * type TranscriptionResult {
   *   Alternatives: Array<{
   *     Items: Array<AWSTranscribeStreamingDocs.Item>,
   *     Transcript: string,
   *   }>,
   *   EndTime: number, # seconds
   *   IsPartial: boolean,
   *   ResultId: string, # uuid
   *   StartTime: number, # seconds
   * }
   *
   * emit('transcription', transcriptionResult TranscriptionResult)
   * ```
   *
   * The `transcription` event. Emitted when a transcription is received from AWS Transcribe streaming.
   *
   * Event Data:
   *   * `transcription` - `TranscriptionResult` - data about the transcription.
   *     * `Alternatives` - a list of possible alternative transcriptions for the input audio segment.
   *       * `Items` - `Array<[AWSTranscribeStreamingDocs.Item](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_streaming_Item.html)>` - array of words, phrases, or punctuation in the transcribed audio output, along with associated metadata such as confidence score, type, and start and end times.
   *       * `Transcript` - the transcribed text.
   *     * `EndTime` - the end time in seconds of the transcription.
   *     * `IsPartial` - whether the transcription is a partial transcription.
   *     * `ResultId` - a unique ID for the transcription result.
   *     * `StartTime` - the start time in seconds of the transcription.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await testTranscribeStream.ready
   *
   * myTranscribeStream.on('transcription', transcription => {
   *   console.log('Received transcription:', transcription.Alternatives[0].Transcript)
   * })
   * ```
   */

  /**
   * @name Event: partialTranscription
   *
   * @docs
   * ```coffeescript [specscript]
   * module AWSTranscribeStreamingDocs 'https://docs.aws.amazon.com/transcribe/latest/APIReference/API_Types.html'
   *
   * type TranscriptionResult {
   *   Alternatives: Array<{
   *     Items: Array<AWSTranscribeStreamingDocs.Item>,
   *     Transcript: string,
   *   }>,
   *   EndTime: number, # seconds
   *   IsPartial: boolean,
   *   ResultId: string, # uuid
   *   StartTime: number, # seconds
   * }
   *
   * emit('partialTranscription', partialTranscriptionResult TranscriptionResult)
   * ```
   *
   * The `partialTranscription` event. Emitted when a partial transcription is received from AWS Transcribe streaming.
   *
   * Event Data:
   *   * `transcription` - `TranscriptionResult` - data about the partial transcription.
   *     * `Alternatives` - a list of possible alternative transcriptions for the input audio segment.
   *       * `Items` - `Array<[AWSTranscribeStreamingDocs.Item](https://docs.aws.amazon.com/transcribe/latest/APIReference/API_streaming_Item.html)>` - array of words, phrases, or punctuation in the transcribed audio output, along with associated metadata such as confidence score, type, and start and end times.
   *       * `Transcript` - the transcribed text.
   *     * `EndTime` - the end time in seconds of the partial transcription.
   *     * `IsPartial` - whether the transcription is a partial transcription.
   *     * `ResultId` - a unique ID for the partial transcription result.
   *     * `StartTime` - the start time in seconds of the partial transcription.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await testTranscribeStream.ready
   *
   * myTranscribeStream.on('partialTranscription', partialTranscription => {
   *   console.log('Received partial transcription:', partialTranscription.Alternatives[0].Transcript)
   * })
   * ```
   */

  /**
   * @name Event: error
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('error', error Error)
   * ```
   *
   * The `error` event. Emitted when an error occurs on a TranscribeStream instance.
   *
   * Event Data:
   *   * `error` - an instance of the JavaScript `Error` class.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await myTranscribeStream.ready
   *
   * myTranscribeStream.on('error', error => {
   *   console.error(error)
   * })
   * ```
   */

  /**
   * @name Event: close
   *
   * @docs
   * ```coffeescript [specscript]
   * emit('close')
   * ```
   *
   * The `close` event. Emitted when a TranscribeStream instance is closed.
   *
   * Event Data:
   *   * (none)
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await myTranscribeStream.ready
   *
   * myTranscribeStream.on('close', () => {
   *   console.log('myTranscribeStream closed.')
   * })
   * ```
   */

  /**
   * @name sendAudioChunk
   *
   * @docs
   * ```coffeescript [specscript]
   * sendAudioChunk(chunk Buffer) -> undefined
   * ```
   *
   * Arguments:
   *   * `chunk` - binary data representing a segment from the input audio. AWS Transcribe streaming assumes this is properly encoded in the specified [mediaEncoding](#TranscribeStream).
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await myTranscribeStream.ready
   *
   * const event = { media: { payload: '...' } }
   *
   * const wav = new WaveFile()
   * wav.fromScratch(1, 8000, '8', Buffer.from(event.media.payload, 'base64'))
   * wav.fromMuLaw()
   *
   * const chunk = Buffer.from(wav.data.samples)
   *
   * myTranscribeStream.sendAudioChunk(chunk)
   * ```
   */
  sendAudioChunk(chunk) {
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
      }
    })
    const length = headersBytes.byteLength + chunk.byteLength + 16
    const bytes = new Uint8Array(length)
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const crc32 = new CRC32()

    view.setUint32(0, length, false)
    view.setUint32(4, headersBytes.byteLength, false)
    view.setUint32(8, crc32.update(Buffer.from(bytes.subarray(0, 8))).checksum, false)
    bytes.set(headersBytes, 12)
    bytes.set(chunk, headersBytes.byteLength + 12)
    view.setUint32(
      length - 4,
      crc32.update(Buffer.from(bytes.subarray(8, length - 4))).checksum,
      false
    )
    this.websocket.send(bytes)
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> undefined
   * ```
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my_profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTranscribeStream = new TranscribeStream({
   *   languageCode: 'en-US',
   *   mediaEncoding: 'pcm',
   *   sampleRate: 8000,
   *   ...awsCreds,
   * })
   * await myTranscribeStream.ready
   *
   * // ...
   *
   * myTranscribeStream.close()
   * ```
   */
  close() {
    this.websocket.close()
    this.emit('close')
  }

}

/**
 * @name marshalHeaders
 *
 * @docs
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
 * @name unmarshalMessage
 *
 * @docs
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
 * @name marshalStringHeaderValue
 *
 * @docs
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
 * @name unmarshalHeaders
 *
 * @docs
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
