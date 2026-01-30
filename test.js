const Test = require('thunk-test')

const test = Test.all([
  require('./Archive.test'),
  require('./AutoScaling.test'),
  // require('./AwsCredentials.test'),
  require('./Dependency.test'),
  require('./Docker.test'),
  require('./DockerContainer.test'),
  require('./DockerImage.test'),
  require('./DockerService.test'),
  require('./DockerSwarm.test'),
  require('./Dynamo.test'),
  require('./DynamoIndex.test'),
  require('./DynamoIndexQueryIterator.test'),
  require('./DynamoStream.test'),
  require('./DynamoTable.test'),
  require('./DynamoTableScanIterator.test'),
  // require('./EC2.test'),
  require('./ECR.test'),
  require('./Elasticsearch.test'),
  require('./Gzip.test'),
  require('./Http.test'),
  require('./HttpServer.test'),
  require('./Kinesis.test'),
  require('./KinesisStream.test'),
  require('./Mongo.test'),
  require('./MongoCollection.test'),
  require('./OptionalValidator.test'),
  require('./Password.test'),
  require('./S3.test'),
  require('./S3Bucket.test'),
  require('./SecretsManager.test'),
  require('./StrictValidator.test'),
  require('./TranscribeStream.test'),
  require('./WebSocketServer.test'),
  require('./teardown.test'),
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
