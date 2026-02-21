const Test = require('thunk-test')

const test = Test.all([
  require('./AwsCredentials.test'),
  require('./Docker.test'),
  require('./DynamoDBTable.test'),
  require('./DynamoDBGlobalSecondaryIndex.test'),
  require('./DynamoDBStream.test'),
  require('./ECR.test'),
  require('./GoogleChromeDevTools.test'),
  require('./GoogleChromeForTesting.test'),
  require('./HTTP.test'),
  require('./NpmToken.test'),
  require('./OptionalValidator.test'),
  require('./Password.test'),
  require('./Readable.test'),
  require('./S3Bucket.test'),
  require('./SecretsManager.test'),
  require('./StrictValidator.test'),
  require('./TranscribeStream.test'),
  require('./WebSocket.test'),
  require('./WebSocketServer.test'),
  require('./WebSocketSecureServer.test'),
  require('./ServerWebSocket.test'),
  require('./XML.test'),

  require('./internal/Archive.test'),
  require('./internal/createUpdateServiceSpec.test'),
  require('./internal/encodeURIComponentRFC3986.test'),
  require('./internal/handleAwsResponse.test'),
  require('./internal/handleDynamoDBStreamGetRecordsError.test'),
  require('./internal/httpConfigure.test'),
  require('./internal/StatusCodeMessage.test'),

  require('./global.test'),
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
