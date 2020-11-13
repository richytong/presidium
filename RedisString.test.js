const Test = require('thunk-test')
const Redis = require('./Redis')
const RedisString = require('./RedisString')

module.exports = Test('RedisString', RedisString)
  .before(async function () {
    this.redis = new Redis('redis://localhost:6379/')
  })
  .beforeEach(async function () {
    await this.redis.connection.flushdb()
  })
  .case('redis://localhost:6379', 'test-string', async function (testString) {
    this.testString = testString
    console.log('testString', testString)
  })
  .after(async function () {
    await this.redis.connection.flushdb()
    this.redis.connection.disconnect()
    this.testString.connection.disconnect()
  })
