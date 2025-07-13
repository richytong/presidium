const Test = require('thunk-test')
const assert = require('assert')
const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBStream = require('./DynamoDBStream')
const S3Bucket = require('./S3Bucket')
const Dependency = require('./Dependency')

const test = new Test('Dependency.teardown', async function () {
  const myDynamoTable = new DynamoDBTable({
    name: 'my_dynamo_table',
    key: [{ a: 'string' }],
    endpoint: 'http://localhost:8000',
    region: 'dynamodblocal',
  })
  await myDynamoTable.ready

  const myDynamoStream = new DynamoDBStream({
    table: 'my_dynamo_table',
    endpoint: 'http://localhost:8000',
    region: 'dynamodblocal',
  })
  await myDynamoStream.ready

  const myS3Bucket = new S3Bucket({
    name: 'my-s3-bucket',
    endpoint: 'http://localhost:9000',
    region: 'us-west-1',
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
  })
  await myS3Bucket.ready

  let didDestroyMyCache = false
  const myCache = {
    destroy() {
      didDestroyMyCache = true
    }
  }

  await Dependency.teardown(null)
  await Dependency.teardown(myDynamoTable)
  await Dependency.teardown(myDynamoStream)
  await Dependency.teardown(myS3Bucket)
  await Dependency.teardown(myCache)
  assert(didDestroyMyCache)

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
