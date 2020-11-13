const thunkify = require('rubico/thunkify')
const Redis = require('./Redis')

/**
 * @name RedisSortedSet
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisSortedSet(connection Redis|IORedis|string|{
 *   host: string,
 *   port: number,
 *   database: number,
 * }, key string) -> RedisSortedSet
 * ```
 *
 * @description
 * A Redis SortedSet ([redis docs](https://redis.io/topics/data-types#sorted-sets)).
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
const RedisSortedSet = function (connection, key) {
  if (this == null || this.constructor != RedisSortedSet) {
    return new RedisSortedSet(connection, key)
  }
  this.connection = new Redis(connection).connection
  this.key = key
  return this
}

RedisSortedSet.prototype.bzpopmax = function bzpopmax(...args) {
  return this.connection.bzpopmax(this.key, ...args)
}

RedisSortedSet.prototype.bzpopmin = function bzpopmin(...args) {
  return this.connection.bzpopmin(this.key, ...args)
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
  return this.connection.zadd(this.key, ...args)
}

RedisSortedSet.prototype.zcard = function zcard() {
  return this.connection.zcard(this.key)
}

RedisSortedSet.prototype.zcount = function zcount(min, max) {
  return this.connection.zcount(this.key, min, max)
}

RedisSortedSet.prototype.zincrby = function zincrby(increment, member) {
  return this.connection.zincrby(this.key, increment, member)
}

RedisSortedSet.prototype.zlexcount = function zlexcount(min, max) {
  return this.connection.zlexcount(this.key, min, max)
}

RedisSortedSet.prototype.zmscore = function zmscore(member, ...members) {
  return this.connection.zmscore(this.key, member, ...members)
}

RedisSortedSet.prototype.zpopmax = function zpopmax(count) {
  return this.connection.zpopmax(this.key, count)
}

RedisSortedSet.prototype.zpopmin = function zpopmin(count) {
  return this.connection.zpopmin(this.key, count)
}

RedisSortedSet.prototype.zrange = function zrange(start, stop, ...options) {
  return this.connection.zrange(this.key, start, stop, ...options)
}

RedisSortedSet.prototype.zrangebylex = function zrangebylex(min, max, ...options) {
  return this.connection.zrangebylex(this.key, min, max, ...options)
}

RedisSortedSet.prototype.zrangebyscore = function zrangebyscore(min, max, ...options) {
  return this.connection.zrangebyscore(this.key, min, max, ...options)
}

RedisSortedSet.prototype.zrank = function zrank(member) {
  return this.connection.zrank(this.key, member)
}

RedisSortedSet.prototype.zrem = function zrem(member, ...members) {
  return this.connection.zrem(this.key, member, ...members)
}

RedisSortedSet.prototype.zremrangebylex = function zremrangebylex(min, max) {
  return this.connection.zremrangebylex(this.key, min, max)
}

RedisSortedSet.prototype.zremrangebyrank = function zremrangebyrank(start, stop) {
  return this.connection.zremrangebyrank(this.key, start, stop)
}

RedisSortedSet.prototype.zremrangebyscore = function zremrangebyscore(min, max) {
  return this.connection.zremrangebyscore(this.key, min, max)
}

RedisSortedSet.prototype.zrevrange = function zrevrange(start, stop, ...options) {
  return this.connection.zrevrange(this.key, start, stop, ...options)
}

RedisSortedSet.prototype.zrevrangebylex = function zrevrangebylex(max, min, ...options) {
  return this.connection.zrevrangebylex(this.key, max, min, ...options)
}

RedisSortedSet.prototype.zrevrangebyscore = function zrevrangebyscore(max, min, ...options) {
  return this.connection.zrevrangebyscore(this.key, max, min, ...options)
}

RedisSortedSet.prototype.zrevrank = function zrevrank(member) {
  return this.connection.zrevrank(this.key, member)
}

RedisSortedSet.prototype.zscan = function zscan(cursor, ...options) {
  return this.connection.zscan(this.key, cursor, ...options)
}

RedisSortedSet.prototype.zscore = function zscore(member) {
  return this.connection.zscore(this.key, member)
}

module.exports = RedisSortedSet
