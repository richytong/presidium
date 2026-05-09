const Test = require('thunk-test')

const test = Test.all([
  require('./AwsCredentials.test'),
  require('./Docker.test'),
  require('./DynamoDBTable.test'),
  require('./DynamoDBStream.test'),
  require('./DynamoDBGlobalSecondaryIndex.test'),
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
  require('./internal/createFilterExpression.test'),
  require('./internal/createKeyConditionExpression.test'),
  require('./internal/dynamoDBStreamGetShardsIterator.test'),
  require('./internal/parseURL.test'),
  require('./internal/encodeURIComponentRFC3986.test'),
  require('./internal/DynamoDBAttributeType.test'),
  require('./internal/DynamoDBAttributeValue.test'),
  require('./internal/DynamoDBAttributeValueJSON.test'),
  require('./internal/getAbsoluteFilePath.test'),
  require('./internal/getChromeBinaryOrExecutableFilePath.test'),
  require('./internal/getChromeUrl.test'),
  require('./internal/getPlatform.test'),
  require('./internal/handleAwsResponse.test'),
  require('./internal/handleDynamoDBStreamGetRecordsError.test'),
  require('./internal/httpConfigure.test'),
  require('./internal/StatusCodeMessage.test'),
  require('./internal/retryHTTPRequest.test'),
  require('./internal/RetryAwsErrors.test'),

  require('./index.test'),
  require('./global.test'),
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
