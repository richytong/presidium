const Test = require('thunk-test')
const DynamoTable = require('presidium/DynamoTable')
const DynamoStream = require('presidium/DynamoStream')
const ElasticsearchIndex = require('presidium/ElasticsearchIndex')
const S3Bucket = require('presidium/S3Bucket')
const KinesisStream = require('presidium/KinesisStream')
const teardown = require('./teardown')

const test = new Test('teardown', async function () {
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

  await teardown(myDynamoTable)
  await teardown(myDynamoStream)
  await teardown(myElasticsearchIndex)
  await teardown(myS3Bucket)
  await teardown(myKinesisStream)
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = teardown
