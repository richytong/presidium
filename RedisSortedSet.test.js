const fork = require('rubico/fork')
const Test = require('thunk-test')
const assert = require('assert')
const RedisSortedSet = require('./RedisSortedSet')

module.exports = Test('RedisSortedSet', RedisSortedSet)
  .before(function () {
    this.redises = []
  })
  .case('redis://localhost:6379', 'test', async function (redisSortedSet) {
    assert(typeof redisSortedSet == 'object')
    assert(typeof redisSortedSet.zadd == 'function')
    await redisSortedSet.ready()
    await redisSortedSet.redis.flushdb()
    await Promise.all([
      redisSortedSet.zadd(1, 'one'),
      redisSortedSet.zadd(2, 'two'),
      redisSortedSet.zadd(3, 'three'),
    ])
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1, 'WITHSCORES'),
      ['one', '1', 'two', '2', 'three', '3'],
    )
    assert.deepEqual(
      await redisSortedSet.zrangebyscore(0, 3, 'WITHSCORES'),
      ['one', '1', 'two', '2', 'three', '3'],
    )
    assert.deepEqual(
      await redisSortedSet.zrevrange(0, -1, 'WITHSCORES'),
      ['three', '3', 'two', '2', 'one', '1'],
    )
    assert.deepEqual(
      await redisSortedSet.zrevrangebyscore(3, 1, 'WITHSCORES'),
      ['three', '3', 'two', '2', 'one', '1'],
    )
    assert.deepEqual(
      await redisSortedSet.zrevrangebyscore(3, 2, 'WITHSCORES'),
      ['three', '3', 'two', '2'],
    )
    await redisSortedSet.redis.flushdb()
    await redisSortedSet.zadd(0, 'a', 1, 'b', 2, 'c')
    assert.deepEqual(
      await redisSortedSet.bzpopmax('does-not-exist', 0),
      ['test', 'c', '2'],
    )
    assert.deepEqual(
      await redisSortedSet.bzpopmax(0),
      ['test', 'b', '1'],
    )
    assert.deepEqual(
      await redisSortedSet.bzpopmin(20),
      ['test', 'a', '0'],
    )
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      [],
    )
    assert.deepEqual(
      await redisSortedSet.zrevrange(0, -1),
      [],
    )
    await redisSortedSet.zadd(0, 'a', 0, 'b', 0, 'c', 0, 'd', 0, 'e', 0, 'f', 0, 'g')
    assert.deepEqual(
      await redisSortedSet.zrangebylex('-', '[c'),
      ['a', 'b', 'c'],
    )
    assert.deepEqual(
      await redisSortedSet.zrevrangebylex('[c', '-'),
      ['c', 'b', 'a'],
    )
    assert.deepEqual(
      await redisSortedSet.zrangebylex('-', '(c'),
      ['a', 'b'],
    )
    assert.deepEqual(
      await redisSortedSet.zrangebylex('[aaa', '(g'),
      ['b', 'c', 'd', 'e', 'f'],
    )
    assert.strictEqual(
      await redisSortedSet.zlexcount('-', '[c'),
      3,
    )
    assert.strictEqual(
      await redisSortedSet.zrank('a'),
      0,
    )
    assert.strictEqual(
      await redisSortedSet.zscore('a'),
      '0',
    )
    assert.strictEqual(
      await redisSortedSet.zrevrank('a'),
      6,
    )
    await redisSortedSet.zrem('a')
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      ['b', 'c', 'd', 'e', 'f', 'g'],
    )
    await redisSortedSet.zremrangebylex('(a', '(c')
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      ['c', 'd', 'e', 'f', 'g'],
    )
    await redisSortedSet.zremrangebyrank(-1, -1)
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      ['c', 'd', 'e', 'f'],
    )
    await redisSortedSet.zremrangebyscore(1)
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      ['c', 'd', 'e', 'f'],
    )
    assert.deepEqual(
      await redisSortedSet.zscan(0),
      ['0', ['c', '0', 'd', '0', 'e', '0', 'f', '0']], // [cursor, [items, scores, ...]]
    )
    await redisSortedSet.zremrangebyscore(0)
    assert.deepEqual(
      await redisSortedSet.zrange(0, -1),
      [],
    )
    this.redises.push(redisSortedSet.redis)
  })
  .after(function () {
    this.redises.forEach(redis => redis.disconnect())
  })
