const Test = require('thunk-test')
const assert = require('assert')
const DynamoTable = require('./DynamoTable')
const DynamoStream = require('./DynamoStream')
const ElasticsearchIndex = require('./ElasticsearchIndex')
const S3Bucket = require('./S3Bucket')
const KinesisStream = require('./KinesisStream')
const Dependency = require('./Dependency')

const test = new Test('Dependency.teardown', async function () {
  const myDynamoTable = new DynamoTable({
    name: 'my_dynamo_table',
    key: [{ a: 'string' }],
    endpoint: 'http://localhost:8000',
    region: 'dynamodblocal',
  })
  await myDynamoTable.ready

  const myDynamoStream = new DynamoStream({
    table: 'my_dynamo_table',
    endpoint: 'http://localhost:8000',
    region: 'dynamodblocal',
  })
  await myDynamoStream.ready

  const myElasticsearchIndex = new ElasticsearchIndex({
    node: 'http://localhost:9200/',
    index: 'local_post',
    mappings: {
      a: { type: 'keyword' },
      b: { type: 'keyword' },
    },
  })
  await myElasticsearchIndex.ready

  const myS3Bucket = new S3Bucket({
    name: 'my-s3-bucket',
    endpoint: 'http://localhost:9000',
    region: 'us-west-1',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  })
  await myS3Bucket.ready

  const myKinesisStream = new KinesisStream({
    name: 'my_kinesis_stream',
    endpoint: 'http://localhost:4567',
    shardIteratorType: 'TRIM_HORIZON',
  })
  await myKinesisStream.ready

  let didDestroyMyCache = false
  const myCache = {
    destroy() {
      didDestroyMyCache = true
    }
  }

  await Dependency.teardown(null)
  await Dependency.teardown(myDynamoTable)
  await Dependency.teardown(myDynamoStream)
  await Dependency.teardown(myElasticsearchIndex)
  await Dependency.teardown(myS3Bucket)
  await Dependency.teardown(myKinesisStream)
  await Dependency.teardown(myCache)
  assert(didDestroyMyCache)

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
