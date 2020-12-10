const Test = require('thunk-test')
const Redis = require('./Redis')
const assert = require('assert')
const fs = require('fs/promises')
const map = require('rubico/map')

module.exports = [
  Test('Redis - string', Redis)
    .before(async function () {
      try {
        await fs.rm(`${__dirname}/tmp.dump`)
      } catch {}
    })
    .case('redis://localhost:6379', async function (redis) {
      await redis.flushdb()

      await redis.set('test-string', 'hey', 'XX')
      assert(await redis.get('test-string') == null)
      await redis.set('test-string', 'hey', 'NX')
      assert(await redis.get('test-string') == 'hey')
      await redis.set('test-string', 0)

      assert(await redis.incr('test-string') == 1)
      assert(await redis.decr('test-string') == 0)
      assert(await redis.incrby('test-string', 3) == 3)
      assert(await redis.decrby('test-string', 0) == 3)
      assert(await redis.decrby('test-string', -2) == 5)
      assert(await redis.strlen('test-string') == 1)
      assert(typeof await redis.strlen('test-string') == 'number')
      assert(await redis.getset('test-string', 'hey') == 5)
      assert(await redis.get('test-string') == 'hey')
      assert(await redis.getrange('test-string', 0, 0) == 'h')
      assert(await redis.getrange('test-string', 1, 1) == 'e')
      assert(await redis.getrange('test-string', 2, 2) == 'y')
      assert(await redis.getrange('test-string', -1, -1) == 'y')
      assert(await redis.getrange('test-string', -2, -2) == 'e')
      assert(await redis.getrange('test-string', -3, -3) == 'h')
      assert(await redis.getrange('test-string', 3, 3) === '')

      await redis.set('test-string', 'immediate-expire', 'PX', 1)
      await new Promise(resolve => setTimeout(resolve, 10))
      assert(await redis.get('test-string') == null)
      assert.deepEqual(await redis.scan(0), ['0', []])
      await redis.set('test-string', 'hey')
      assert.deepEqual(await redis.scan(0), ['0', ['test-string']])

      assert(await redis.ttl('test-string') == -1)
      assert(await redis.pttl('test-string') == -1)
      assert(await redis.expire('test-string', 1e6) == 1)
      assert(await redis.ttl('test-string') > 0)
      assert(await redis.pexpire('test-string', 1e6) == 1)
      assert(await redis.pttl('test-string') > 0)
      assert(await redis.expireat('test-string', Date.now() + 1e6) == 1)
      assert(await redis.ttl('test-string') > 0)
      assert(await redis.pexpireat('test-string', Date.now() + 1e6) == 1)
      assert(await redis.pttl('test-string') > 0)
      assert(await redis.type('test-string') == 'string')
      assert(await redis.del('test-string') == 1)

      await redis.set('test-string', 'hey')
      await redis.append('test-string', 'heyhey')
      assert(await redis.get('test-string'), 'heyheyhey')
      assert(await redis.unlink('test-string') == 1)

      await redis.disconnect()
    }),

  Test('Redis - sorted set', Redis)
    .case('redis://localhost:6379', async function (redis) {
      await redis.flushdb()

      await Promise.all([
        redis.zadd('test:sortedSet', 1, 'one'),
        redis.zadd('test:sortedSet', 2, 'two'),
        redis.zadd('test:sortedSet', 3, 'three'),
      ])
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1, 'WITHSCORES'),
        ['one', '1', 'two', '2', 'three', '3'],
      )
      assert.deepEqual(
        await redis.zrangebyscore('test:sortedSet', 0, 3, 'WITHSCORES'),
        ['one', '1', 'two', '2', 'three', '3'],
      )
      assert.deepEqual(
        await redis.zrevrange('test:sortedSet', 0, -1, 'WITHSCORES'),
        ['three', '3', 'two', '2', 'one', '1'],
      )
      assert.deepEqual(
        await redis.zrevrangebyscore('test:sortedSet', 3, 1, 'WITHSCORES'),
        ['three', '3', 'two', '2', 'one', '1'],
      )
      assert.deepEqual(
        await redis.zrevrangebyscore('test:sortedSet', 3, 2, 'WITHSCORES'),
        ['three', '3', 'two', '2'],
      )
      await redis.flushdb()
      await redis.zadd('test:sortedSet', 0, 'a', 1, 'b', 2, 'c')
      assert.deepEqual(
        await redis.bzpopmax('test:sortedSet', 'does-not-exist', 0),
        ['test:sortedSet', 'c', '2'],
      )
      assert.deepEqual(
        await redis.bzpopmax('test:sortedSet', 0),
        ['test:sortedSet', 'b', '1'],
      )
      assert.deepEqual(
        await redis.bzpopmin('test:sortedSet', 20),
        ['test:sortedSet', 'a', '0'],
      )
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        [],
      )
      assert.deepEqual(
        await redis.zrevrange('test:sortedSet', 0, -1),
        [],
      )
      await redis.zadd('test:sortedSet', 0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e', 0, 'f', 0, 'g')
      assert.deepEqual(
        await redis.zrangebylex('test:sortedSet', '-', '[c'),
        ['a', 'b', 'c'],
      )
      assert.deepEqual(
        await redis.zrevrangebylex('test:sortedSet', '[c', '-'),
        ['c', 'b', 'a'],
      )
      assert.deepEqual(
        await redis.zrangebylex('test:sortedSet', '-', '(c'),
        ['a', 'b'],
      )
      assert.deepEqual(
        await redis.zrangebylex('test:sortedSet', '[aaa', '(g'),
        ['b', 'c', 'd', 'e', 'f'],
      )
      assert.strictEqual(
        await redis.zlexcount('test:sortedSet', '-', '[c'),
        3,
      )
      assert.strictEqual(
        await redis.zrank('test:sortedSet', 'a'),
        0,
      )
      assert.strictEqual(
        await redis.zscore('test:sortedSet', 'a'),
        '0',
      )
      assert.strictEqual(
        await redis.zrevrank('test:sortedSet', 'a'),
        6,
      )
      await redis.zrem('test:sortedSet', 'a')
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        ['b', 'c', 'd', 'e', 'f', 'g'],
      )
      await redis.zremrangebylex('test:sortedSet', '(a', '(c')
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        ['c', 'd', 'e', 'f', 'g'],
      )
      await redis.zremrangebyrank('test:sortedSet', -1, -1)
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        ['c', 'd', 'e', 'f'],
      )
      await redis.zremrangebyscore('test:sortedSet', 1, 1)
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        ['c', 'd', 'e', 'f'],
      )
      assert.deepEqual(
        await redis.zscan('test:sortedSet', 0),
        ['0', ['c', '0', 'd', '0', 'e', '0', 'f', '0']], // [cursor, [item, score, ...]]
      )
      await redis.zremrangebyscore('test:sortedSet', 0, 0)
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        [],
      )
      await redis.flushdb()
      redis.disconnect()
    }),

  Test('Redis - list', Redis)
    .case('redis://localhost:6379', async function (redis) {
      await redis.flushdb()
      await redis.lpushx('test-list', 'a')
      await redis.lpush('test-list', 'a')
      assert(await redis.lindex('test-list', 0) == 'a')
      await redis.linsert('test-list', 'AFTER', 'a', 'b')
      assert.deepEqual(await redis.lrange('test-list', 0, 1), ['a', 'b'])
      await redis.rpush('test-list', 'c', 'd', 'e')
      await redis.lpop('test-list')
      await redis.rpop('test-list')
      assert.deepEqual(await redis.lrange('test-list', 0, -1), ['b', 'c', 'd'])
      return () => {
        redis.disconnect()
      }
    })
    .case('redis://localhost:6379', async function (redis) {
      await redis.flushdb()
      let popPromise = redis.blpop('test-list', 1e6)
      const anotherRedis = Redis({ host: 'localhost', port: 6379 })
      await anotherRedis.lpush('test-list', 'hey')
      assert.deepEqual(await popPromise, ['test-list', 'hey'])
      popPromise = redis.brpop('test-list', 1e6)
      await anotherRedis.rpush('test-list', 'ho')
      assert.deepEqual(await popPromise, ['test-list', 'ho'])
      return () => {
        redis.disconnect()
        anotherRedis.disconnect()
      }
    }),
]
