const assert = require('assert')
const Test = require('thunk-test')
const Redis = require('./Redis')
const RedisList = require('./RedisList')

module.exports = Test('RedisList', RedisList)
  .before(async function () {
    this.redis = new Redis('redis://localhost:6379/')
  })
  .beforeEach(async function () {
    await this.redis.connection.flushdb()
  })
  .case('redis://localhost:6379', 'test-list', async function (testList) {
    await testList.lpushx('a')
    await testList.lpush('a')
    assert(await testList.lindex(0) == 'a')
    await testList.linsert('AFTER', 'a', 'b')
    assert.deepEqual(await testList.lrange(0, 1), ['a', 'b'])
    await testList.rpush('c', 'd', 'e')
    await testList.lpop()
    await testList.rpop()
    assert.deepEqual(await testList.lrange(0, -1), ['b', 'c', 'd'])
    return () => {
      testList.connection.disconnect()
    }
  })
  .case('redis://localhost:6379', 'test-list', async function (testList) {
    let popPromise = testList.blpop(1e6)
    const anotherTestList = new RedisList(this.redis, 'test-list')
    await anotherTestList.lpush('hey')
    assert.deepEqual(await popPromise, ['test-list', 'hey'])
    popPromise = testList.brpop(1e6)
    await anotherTestList.rpush('ho')
    assert.deepEqual(await popPromise, ['test-list', 'ho'])
    return () => {
      testList.connection.disconnect()
    }
  })
  .after(async function () {
    await this.redis.connection.flushdb()
    this.redis.connection.disconnect()
  })
