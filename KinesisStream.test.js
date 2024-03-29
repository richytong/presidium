const assert = require('assert')
const Test = require('thunk-test')
const KinesisStream = require('./KinesisStream')
const crypto = require('crypto')
const asyncIterableTake = require('./internal/asyncIterableTake')
const map = require('rubico/map')
const thunkify = require('rubico/thunkify')

const test = new Test('KinesisStream', KinesisStream)

.before(function () {
  this.streams = []
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardIteratorType: 'TRIM_HORIZON',
  getRecordsLimit: 1,
  listShardsLimit: 1,
}, async function (myStream) {
  await myStream.ready
  await myStream.putRecord('hey')
  await myStream.putRecord('ho', { partitionKey: 'ho' })
  await myStream.putRecord('hi', { explicitHashKey: '127' })
  const first3 = await asyncIterableTake(3)(myStream)
  const first3Again = await asyncIterableTake(3)(myStream)
  assert.deepEqual(first3, first3Again)
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardIteratorType: 'TRIM_HORIZON',
  getRecordsLimit: 1,
  listShardsLimit: 1,
  shardCount: 2,
}, async function (myStream) {
  await myStream.ready
  await myStream.putRecord('hey', { partitionKey: 'a' })
  await myStream.putRecord('ho', { partitionKey: 'a' })
  await myStream.putRecord('hi', { partitionKey: 'a' })
  const first3 = await asyncIterableTake(3)(myStream)
  const first3Again = await asyncIterableTake(3)(myStream)
  assert.deepEqual(first3, first3Again)
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardIteratorType: 'TRIM_HORIZON',
}, async function (myStream) {
  await myStream.ready
  await myStream.putRecords([
    { data: 'hey' },
    { data: 'ho', partitionKey: 'ho' },
    { data: 'hi', explicitHashKey: '127' },
  ])
  const first3 = await asyncIterableTake(3)(myStream)
  const first3Again = await asyncIterableTake(3)(myStream)
  assert.deepEqual(first3, first3Again)
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardIteratorType: 'TRIM_HORIZON',
}, async function (myStream) {
  myStream.kinesis.client.putRecords = () => ({
    promise: async () => ({
      Records: [
        {
          ErrorCode: 'ProvisionedThroughputExceededException',
          ErrorMessage: 'Some message with accountId, stream name, and shard ID',
        },
        {
          ErrorCode: 'ProvisionedThroughputExceededException',
          ErrorMessage: 'Some message with accountId, stream name, and shard ID',
        },
      ],
    }),
  })
  await myStream.ready
  await assert.rejects(
    () => myStream.putRecords([{ data: 'hey' }]),
    new AggregateError([
      new Error('Some message with accountId, stream name, and shard ID'),
      new Error('Some message with accountId, stream name, and shard ID'),
    ], 'Some records failed to process')
  )
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardIteratorType: 'AT_TIMESTAMP',
  timestamp: new Date(Date.now() - 5000),
}, async function (myStream) {
  await myStream.ready
  await myStream.putRecord('hey')
  await myStream.putRecord('ho', { partitionKey: 'ho' })
  await myStream.putRecord('hi', { explicitHashKey: '127' })
  const first3 = await asyncIterableTake(3)(myStream)
  const first3Again = await asyncIterableTake(3)(myStream)
  assert.deepEqual(first3, first3Again)
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
}, async function (myStream) {
  await myStream.ready
  await myStream.putRecord('hey')
  await myStream.putRecord('ho', { partitionKey: 'ho' })
  await myStream.putRecord('hi', { explicitHashKey: '127' })

  // subscribing after the records were put on latest, so this should hang
  const latestRecordPromise = asyncIterableTake(1)(myStream)
  const raceResult = await Promise.race([
    latestRecordPromise,
    new Promise(resolve => setTimeout(thunkify(resolve, 'hey'), 3000))
  ])
  assert.equal(raceResult, 'hey')
  myStream.close()
  this.streams.push(myStream)
})

.case({
  name: 'my-stream',
  endpoint: 'http://localhost:4567',
  shardUpdatePeriod: 500,
}, async function (myStream) {
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
  // ensure shards don't update after close
  await new Promise(resolve => setTimeout(resolve, 1000))
})

.after(async function () {
  await map(async function cleanup(stream) {
    stream.close()
    await stream.delete()
  })(this.streams)
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
