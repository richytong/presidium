require('rubico/global')
const fs = require('fs')
const readline = require('readline')
const WaveFile = require('wavefile').WaveFile
const Test = require('thunk-test')
const assert = require('assert')
const TranscribeStream = require('./TranscribeStream')
const AwsCredentials = require('./AwsCredentials')

const test = new Test('TranscribeStream', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1' // only valid region for transcribe

  const testTranscribeStream = new TranscribeStream({
    languageCode: 'en-US',
    mediaEncoding: 'pcm',
    sampleRate: 8000,
    ...awsCreds,
  })
  await testTranscribeStream.ready

  const mediaStreamFixtureAwsKeynote =
    fs.createReadStream('./fixtures/media-stream-fixture-aws-keynote.txt')
  const rl = readline.createInterface({
    input: mediaStreamFixtureAwsKeynote,
  })
  rl.on('line', line => {
    const event = JSON.parse(line)
    if (event.event == 'media') {
      const wav = new WaveFile()
      wav.fromScratch(1, 8000, '8', Buffer.from(event.media.payload, 'base64'))
      wav.fromMuLaw()
      testTranscribeStream.sendAudioChunk(Buffer.from(wav.data.samples))
    }
  })

  const testTranscription = await new Promise(resolve => {
    testTranscribeStream.on('transcription', transcription => {
      resolve(transcription.Alternatives[0].Transcript)
    })
  })
  console.log(testTranscription)
  assert(testTranscription.toLowerCase().includes('hello'), testTranscription)
  assert(testTranscription.toLowerCase().includes('world'), testTranscription)

  console.log('Waiting for timeout error to test error handling...')
  await new Promise(resolve => {
    testTranscribeStream.on('error', error => {
      testTranscribeStream.close()
      resolve()
    })
  })

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
