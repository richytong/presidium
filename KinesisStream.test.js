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
.after(async function() {
  await map(stream => stream.delete())(this.streams)
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
