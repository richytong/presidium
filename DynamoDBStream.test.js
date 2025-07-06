require('rubico/global')
const assert = require('assert')
const Test = require('thunk-test')
const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBStream = require('./DynamoDBStream')
const asyncIterableTake = require('./internal/asyncIterableTake')

const ResourceNotFoundException = function (message) {
  const error = new Error(message)
  error.code = 'ResourceNotFoundException'
  return error
}

const test0 = Test('DynamoDBStream.handleGetRecordsError', DynamoDBStream.handleGetRecordsError)
.case(new Error('Shard iterator has expired'), [])
.throws(new Error('other'), new Error('other'))

const test1 = Test('DynamoDBStream', function construct(options) {
  return new DynamoDBStream(options)
})

.before(async function deleteTable() {
  const table = new DynamoDBTable({
    name: 'my-table',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000',
  })
  await table.ready
  await table.delete()
})

.before(async function createTable() {
  this.table = new DynamoDBTable({
    name: 'my-table',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000',
  })
  await this.table.ready
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  shardIteratorType: 'TRIM_HORIZON',
  shardUpdatePeriod: 1000,
}, async function integration1(myStream) {
  await myStream.ready

  const table = this.table
  await table.putItem({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'George',
  })
  await table.putItem({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItem({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItem({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'sally',
  })
  await table.putItem({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  const first5 = await asyncIterableTake(5)(myStream)
  assert.strictEqual(first5.length, 5)
  myStream.close()
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  getRecordsLimit: 1,
  getRecordsInterval: 1000,
  shardUpdatePeriod: 1000,
  shardIteratorType: 'TRIM_HORIZON',
}, async function integration2(myStream) {
  await myStream.ready

  const table = this.table
  await table.putItem({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'George',
  })
  await table.putItem({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItem({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItem({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'sally',
  })
  await table.putItem({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  const first5 = await asyncIterableTake(5)(myStream)
  assert.strictEqual(first5.length, 5)
  myStream.close()
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  getRecordsLimit: 1,
  shardUpdatePeriod: 1000,
  shardIteratorType: 'TRIM_HORIZON',
}, async function integration3(myStream) {
  await myStream.ready

  const table = this.table
  await table.putItem({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'George',
  })
  await table.putItem({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItem({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItem({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'sally',
  })
  await table.putItem({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  const first5 = await asyncIterableTake(5)(myStream)
  assert.strictEqual(first5.length, 5)
  myStream.close()
  await table.delete()
  this.table = new DynamoDBTable({
    name: 'my-table',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000',
  })
  await this.table.ready
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  listStreamsLimit: 1,
  shardIteratorType: 'TRIM_HORIZON',
  debug: true,
  shardUpdatePeriod: 1000,
}, async function integration4(myStream) {
  await myStream.ready

  const table = this.table
  await table.putItem({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'George',
  })
  await table.putItem({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItem({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItem({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'sally',
  })
  await table.putItem({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  const first5 = await asyncIterableTake(5)(myStream)
  assert.strictEqual(first5.length, 5)
  myStream.close()
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  listStreamsLimit: 1,
  shardIteratorType: 'TRIM_HORIZON',
  debug: true,
  shardUpdatePeriod: 1000,
}, async function integration5(myStream) {
  await myStream.ready

  const originalClient = myStream.client
  const alternatingErrorClient = {
    listStreams(options) {
      return originalClient.listStreams(options)
    },
    describeStream(options) {
      return originalClient.describeStream(options)
    },
    getShardIterator(options) {
      return originalClient.getShardIterator(options)
    },
    getRecordsCount: 0,
    getRecords(options) {
      return {
        async promise() {
          if (alternatingErrorClient.getRecordsCount % 2 == 0) {
            const error = new Error('stub error')
            error.retryable = true
            alternatingErrorClient.getRecordsCount += 1
            throw error
          }
          alternatingErrorClient.getRecordsCount += 1
          return originalClient.getRecords(options).promise()
        },
      }
    },
  }
  myStream.client = alternatingErrorClient

  const table = this.table
  await table.putItem({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'George',
  })
  await table.putItem({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItem({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItem({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'sally',
  })
  await table.putItem({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  const first5 = await asyncIterableTake(5)(myStream)
  assert.strictEqual(first5.length, 5)
  myStream.close()
})

.case({
  table: 'my-table',
  endpoint: 'http://localhost:8000',
  shardUpdatePeriod: 500,
}, async function integration6(myStream) {
  await myStream.ready

  // there shouldn't be any more records, so this should hang
  const latestRecordPromise = asyncIterableTake(1)(myStream)
  const raceResult = await Promise.race([
    latestRecordPromise,
    new Promise(resolve => setTimeout(thunkify(resolve, 'hey'), 3000))
  ])
  assert.equal(raceResult, 'hey')
  // wait a second for shard update
  await new Promise(resolve => setTimeout(thunkify(resolve, 'hey'), 1000))
  myStream.close()
})

const test = Test.all([
  test0,
  test1,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
