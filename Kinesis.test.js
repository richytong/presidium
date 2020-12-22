const assert = require('assert')
const Test = require('thunk-test')
const Kinesis = require('./Kinesis')

module.exports = Test('Kinesis', Kinesis)
  .case({
    endpoint: 'http://localhost:4567',
  }, async function (kinesis) {
    await kinesis.ready
    assert.strictEqual(kinesis.constructor, Kinesis)
  })
