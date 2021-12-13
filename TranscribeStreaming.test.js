const WebSocketServer = require('presidium/WebSocketServer')
const Twilio = require('@claimyr_hq/twilio/Twilio')
const fs = require('fs')
const readline = require('readline')
const WaveFile = require('wavefile').WaveFile
const Test = require('thunk-test')
const assert = require('assert')
const rubico = require('rubico')
const ngrok = require('ngrok')
const TranscribeStreaming = require('./TranscribeStreaming')
const AwsCredentials = require('./internal/AwsCredentials')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, set, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

const test = new Test('TranscribeStreaming', async function () {
  const awsCreds = await AwsCredentials('default').catch(error => {
    if (error.code == 'ENOENT') {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
      if (accessKeyId == null || secretAccessKey == null) {
        throw new Error('No AWS credential file or environment variables')
      }
      return { accessKeyId, secretAccessKey }
    }
    throw error
  })
  awsCreds.region = 'us-east-1' // only valid region for transcribe

  const testTranscribeStreaming = new TranscribeStreaming({
    languageCode: 'en-US',
    mediaEncoding: 'pcm',
    sampleRate: 8000,
    ...awsCreds,
  })
  await testTranscribeStreaming.ready

  const mediaStreamFixtureAwsKeynote = 
    fs.createReadStream('./media-stream-fixture-aws-keynote.txt')
  const rl = readline.createInterface({
    input: mediaStreamFixtureAwsKeynote,
  })
  rl.on('line', line => {
    const event = JSON.parse(line)
    if (event.event == 'media') {
      const wav = new WaveFile()
      wav.fromScratch(1, 8000, '8', Buffer.from(event.media.payload, 'base64'))
      wav.fromMuLaw()
      testTranscribeStreaming.sendAudioChunk(Buffer.from(wav.data.samples))
    } else if (event.event == 'stop') {
      testTranscribeStreaming.websocket.close()
    }
  })

  const testTranscription = await new Promise(resolve => {
    testTranscribeStreaming.on('transcription', transcription => {
      resolve(transcription.Alternatives[0].Transcript)
    })
  })
  assert.equal(testTranscription, 'Hello, world.')

  /*
  // fill media-stream-fixture-aws-keynote.txt
  const testPort = 7538
  const mediaStreamFixtureAwsKeynote =
    fs.createWriteStream('./media-stream-fixture-aws-keynote.txt', { flags: 'a' })
  new WebSocketServer(socket => {
    socket.on('message', chunk => {
      const message = JSON.parse(chunk.toString('utf8'))
      mediaStreamFixtureAwsKeynote.write(chunk.toString('utf8'))
      mediaStreamFixtureAwsKeynote.write('\n')
      console.log('Got message:')
      console.log(message)
    })
    socket.on('error', error => {
      console.error(error)
    })
  }).listen(testPort, () => {
    console.log('test websocket server listening on port', testPort)
  })
  const exposedUrl = await ngrok.connect(testPort)
  console.log('exposing', testPort, 'at', exposedUrl)

  const twilio = new Twilio({
    accountSid: 'AC437bfe093bc08b7c0e971c080618c83e', // Toll Free accountSid
    authToken: 'cc49ec2511ced213d5375f9971ac853a', // Toll Free authToken
  })
  await twilio.createCall({
    from: '+18557821665', // test tollfree numbers makes real calls
    to: '+18586883603',
    twiml: `
<Response>
<Start>
<Stream url="${exposedUrl.replace(/^https/, 'wss')}" />
</Start>
<Pause length="84600" />
</Response>
    `.trim(),
  }).then(async response => {
    if (response.ok) {
      console.log(await response.json())
    } else {
      console.error(await response.text())
    }
  })
  */

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test