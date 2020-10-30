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

const isBinary = ArrayBuffer.isView

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
 *   keyspace string|(any=>string),
 *   connection string|{ host: string, port: number, database: number },
 * ) -> redisSortedSet Object
 * ```
 *
 * @description
 * A Redis SortedSet ([redis docs](https://redis.io/topics/data-types#sorted-sets)). Supply a function as the keyspace to create a sharded collection.
 *
 * ```javascript
 * RedisSortedSet('your-prefix:', 'redis://localhost:6379')
 *
 * RedisSortedSet(item => `another-prefix:${item.id}`, {
 *   host: 'your-domain.hash.ng.0001.use1.cache.amazonaws.com',
 *   port: 6379,
 *   database: 0,
 * })
 * ```
 */
const RedisSortedSet = function (keyspace, connection) {
  if (this == null || this.constructor != RedisSortedSet) {
    return new RedisSortedSet(keyspace, connection)
  }
  this.keyspace = typeof keyspace == 'function' ? keyspace : always(keyspace)
  this.connection = typeof connection == 'string'
    ? parseRedisConnectionString(connection)
    : connection
  this.redis = new Redis(this.connection)
}

/**
 * @name RedisSortedSet.prototype.zadd
 *
 * @synopsis
 * ```coffeescript [specscript]
 * var option 'XX'|'NX'|'LT'|'GT'|'CH'|'WITHSCORES',
 *   options Array<option>
 *
 * RedisSortedSet(
 *   keyspace string|(any=>string),
 *   connection string|{ host: string, port: number, database: number },
 * ).zadd(
 *   score string|number,
 *   member string,
 *   ...options
 * ) -> numElementsAddedToSortedSet Promise<number>
 * ```
 *
 * @description
 * See [redis documentation for zadd](https://redis.io/commands/zadd).
 */
RedisSortedSet.prototype.zadd = function zadd(score, member, ...options) {
  return this.redis.zadd(this.keyspace(member), score, member, ...options)
}

module.exports = RedisSortedSet
