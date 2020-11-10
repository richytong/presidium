const rubico = require('rubico')
const rubicoX = require('rubico/x')
const Redis = require('ioredis')
const ThunkTest = require('thunk-test')
const assert = require('assert')
const parseRedisConnectionString = require('./internal/parseRedisConnectionString')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

const {
  isString,
  trace,
} = rubicoX

const arrayBufferIsView = ArrayBuffer.isView

const arrayFrom = Array.from

const stringifyJSON = JSON.stringify

const parseJSON = JSON.parse

// (from number, to number) => value Array|string => Array|string
const slice = (from, to) => value => value.slice(from, to < 0 ? value.length + to : to)

/**
 * @name RedisSortedSet
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisSortedSet(
 *   key string|(any=>string),
 *   connection string|{ host: string, port: number, database: number },
 * ) -> redisSortedSet Object
 * ```
 *
 * @description
 * A Redis SortedSet ([redis docs](https://redis.io/topics/data-types#sorted-sets)). Supply a function as the key to create a sharded collection.
 *
 * ```javascript
 * RedisSortedSet('redis://localhost:6379', 'your:key')
 *
 * RedisSortedSet({
 *   host: 'your-domain.hash.ng.0001.use1.cache.amazonaws.com',
 *   port: 6379,
 *   database: 0,
 * }, 'your:key')
 * ```
 */
const RedisSortedSet = function (redis, key) {
  if (this == null || this.constructor != RedisSortedSet) {
    return new RedisSortedSet(redis, key)
  }
  if (redis == null) {
    throw new TypeError('redis must be a Redis instance, a connection string, or a connection object')
  }
  if (key == null) {
    throw new TypeError('key must be a string')
  }
  this.redis = redis.constructor == Redis ? redis
    : typeof redis == 'string' ? new Redis(parseRedisConnectionString(redis))
    : new Redis(redis)
  this.key = key
  this.ready = new Promise(resolve => {
    this.redis.on('ready', resolve)
  })
}

RedisSortedSet.prototype.bzpopmax = function bzpopmax(...args) {
  return this.redis.bzpopmax(this.key, ...args)
}

RedisSortedSet.prototype.bzpopmin = function bzpopmin(...args) {
  return this.redis.bzpopmin(this.key, ...args)
}

/**
 * @name RedisSortedSet.prototype.zadd
 *
 * @synopsis
 * ```coffeescript [specscript]
 * var key string,
 *   redisConnectionString string,
 *   redisConnection { host: string, port: number, database: number },
 *   redis Redis,
 *   option 'XX'|'NX'|'LT'|'GT'|'CH'|'WITHSCORES',
 *   options Array<option>,
 *   score number,
 *   member string,
 *   args Array<(score, member)|option>
 *
 * RedisSortedSet(redisConnectionString, key).zadd(...args) -> Promise<number>
 *
 * RedisSortedSet(redisConnection, key).zadd(...args) -> Promise<number>
 *
 * RedisSortedSet(redis, key).zadd(...args) -> Promise<number>
 * ```
 *
 * @description
 * See redis documentation for [zadd](https://redis.io/commands/zadd).
 *
 * ```javascript
 * const mySortedSet = new RedisSortedSet('redis://localhost:6379/0', 'my:sortedSet:key')
 *
 * mySortedSet.zadd(1, 'one', 2, 'two', 3, 'three') // -> Promise<number>
 * ```
 */
RedisSortedSet.prototype.zadd = function zadd(...args) {
  return this.redis.zadd(this.key, ...args)
}

RedisSortedSet.prototype.zcard = function zcard() {
  return this.redis.zcard(this.key)
}

RedisSortedSet.prototype.zcount = function zcount(min, max) {
  return this.redis.zcount(this.key, min, max)
}

RedisSortedSet.prototype.zincrby = function zincrby(increment, member) {
  return this.redis.zincrby(this.key, increment, member)
}

RedisSortedSet.prototype.zlexcount = function zlexcount(min, max) {
  return this.redis.zlexcount(this.key, min, max)
}

RedisSortedSet.prototype.zmscore = function zmscore(member, ...members) {
  return this.redis.zmscore(this.key, member, ...members)
}

RedisSortedSet.prototype.zpopmax = function zpopmax(count) {
  return this.redis.zpopmax(this.key, count)
}

RedisSortedSet.prototype.zpopmin = function zpopmin(count) {
  return this.redis.zpopmin(this.key, count)
}

RedisSortedSet.prototype.zrange = function zrange(start, stop, ...options) {
  return this.redis.zrange(this.key, start, stop, ...options)
}

RedisSortedSet.prototype.zrangebylex = function zrangebylex(min, max, ...options) {
  return this.redis.zrangebylex(this.key, min, max, ...options)
}

RedisSortedSet.prototype.zrangebyscore = function zrangebyscore(min, max, ...options) {
  return this.redis.zrangebyscore(this.key, min, max, ...options)
}

RedisSortedSet.prototype.zrank = function zrank(member) {
  return this.redis.zrank(this.key, member)
}

RedisSortedSet.prototype.zrem = function zrem(member, ...members) {
  return this.redis.zrem(this.key, member, ...members)
}

RedisSortedSet.prototype.zremrangebylex = function zremrangebylex(min, max) {
  return this.redis.zremrangebylex(this.key, min, max)
}

RedisSortedSet.prototype.zremrangebyrank = function zremrangebyrank(start, stop) {
  return this.redis.zremrangebyrank(this.key, start, stop)
}

RedisSortedSet.prototype.zremrangebyscore = function zremrangebyscore(min, max) {
  return this.redis.zremrangebyscore(this.key, min, max)
}

RedisSortedSet.prototype.zrevrange = function zrevrange(start, stop, ...options) {
  return this.redis.zrevrange(this.key, start, stop, ...options)
}

RedisSortedSet.prototype.zrevrangebylex = function zrevrangebylex(max, min, ...options) {
  return this.redis.zrevrangebylex(this.key, max, min, ...options)
}

RedisSortedSet.prototype.zrevrangebyscore = function zrevrangebyscore(max, min, ...options) {
  return this.redis.zrevrangebyscore(this.key, max, min, ...options)
}

RedisSortedSet.prototype.zrevrank = function zrevrank(member) {
  return this.redis.zrevrank(this.key, member)
}

RedisSortedSet.prototype.zscan = function zscan(cursor, ...options) {
  return this.redis.zscan(this.key, cursor, ...options)
}

RedisSortedSet.prototype.zscore = function zscore(member) {
  return this.redis.zscore(this.key, member)
}

module.exports = RedisSortedSet
