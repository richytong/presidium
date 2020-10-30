const ThunkTest = require('thunk-test')
const assert = require('assert')
const RedisSortedSet = require('./RedisSortedSet')

ThunkTest('RedisSortedSet', RedisSortedSet)
  .case('test:', 'redis://localhost:6379', async function (redisSortedSet) {
    assert(typeof redisSortedSet == 'object')
    assert(typeof redisSortedSet.zadd == 'function')
    await redisSortedSet.redis.flushdb()
    redisSortedSet.redis.disconnect()
  })
  .case(item => `test2:${item.id}`, 'redis://localhost:6379', async function (redisSortedSet) {
    this.redis = redisSortedSet.redis
    await redisSortedSet.redis.flushdb()
    redisSortedSet.redis.disconnect()
  })
()
