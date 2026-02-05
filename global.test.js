const Test = require('thunk-test')
const assert = require('assert')
require('./global')

const test = new Test('global', async function integration() {
  assert.equal(typeof WebSocket, 'function')
  assert.equal(typeof Archive, 'function')
  assert.equal(typeof AwsCredentials, 'function')
  assert.equal(typeof Docker, 'function')
  assert.equal(typeof DynamoDBGlobalSecondaryIndex, 'function')
  assert.equal(typeof DynamoDBStream, 'function')
  assert.equal(typeof DynamoDBTable, 'function')
  assert.equal(typeof ECR, 'function')
  assert.equal(typeof HTTP, 'function')
  assert.equal(typeof NpmToken, 'function')
  assert.equal(typeof OptionalValidator, 'function')
  assert.equal(typeof Password, 'object')
  assert.equal(typeof Readable, 'object')
  assert.equal(typeof S3Bucket, 'function')
  assert.equal(typeof SecretsManager, 'function')
  assert.equal(typeof StrictValidator, 'function')
  assert.equal(typeof TranscribeStream, 'function')
  assert.equal(typeof WebSocket, 'function')
  assert.equal(typeof WebSocketServer, 'function')
  assert.equal(typeof WebSocketSecureServer, 'function')
  assert.equal(typeof ServerWebSocket, 'function')
  assert.equal(typeof XML, 'object')
  assert.equal(typeof userAgent, 'string')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
