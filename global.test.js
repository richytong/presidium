const Test = require('thunk-test')
const assert = require('assert')
require('./global')

const test = new Test('global', async function integration() {
  AwsCredentials
  DatabaseLoadBalancer
  DatabaseServer
  DiskHashTable
  DiskHashTableClient
  DiskSortedHashTable
  DiskSortedHashTableClient
  Docker
  DynamoDBGlobalSecondaryIndex
  DynamoDBStream
  DynamoDBTable
  ECR
  GoogleChromeDevTools
  GoogleChromeForTesting
  HTTP
  NpmToken
  OptionalValidator
  Password
  Readable
  S3Bucket
  Secrets
  SecretsManager
  StrictValidator
  TranscribeStream
  userAgent
  WebSocket
  WebSocketServer
  WebSocketSecureServer
  ServerWebSocket
  Validator
  XML
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
