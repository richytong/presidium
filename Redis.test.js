const Test = require('thunk-test')
const Redis = require('./Redis')
const assert = require('assert')

module.exports = [
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
        ['test', 'c', '2'],
      )
      assert.deepEqual(
        await redis.bzpopmax('test:sortedSet', 0),
        ['test', 'b', '1'],
      )
      assert.deepEqual(
        await redis.bzpopmin('test:sortedSet', 20),
        ['test', 'a', '0'],
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
      await redis.zremrangebyscore('test:sortedSet', 1)
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        ['c', 'd', 'e', 'f'],
      )
      assert.deepEqual(
        await redis.zscan('test:sortedSet', 0),
        ['0', ['c', '0', 'd', '0', 'e', '0', 'f', '0']], // [cursor, [items, scores, ...]]
      )
      await redis.zremrangebyscore('test:sortedSet', 0)
      assert.deepEqual(
        await redis.zrange('test:sortedSet', 0, -1),
        [],
      )
      await redis.flushdb()
      redis.disconnect()
    })(),
]
