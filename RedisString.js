const thunkify = require('rubico/thunkify')
const Redis = require('./Redis')

/**
 * @name RedisString
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection Redis|IORedis|string|{
 *   host: string,
 *   port: number,
 *   database: number,
 * }, key string) -> RedisString
 * ```
 *
 * @description
 * A Redis String ([redis docs](https://redis.io/topics/data-types#strings)).
 *
 * ```javascript
 * RedisString('redis://localhost:6379', 'your:key')
 *
 * RedisString({
 *   host: 'your-domain.hash.ng.0001.use1.cache.amazonaws.com',
 *   port: 6379,
 *   database: 0,
 * }, 'your:key')
 * ```
 */
const RedisString = function (connection, key) {
  if (this == null || this.constructor != RedisString) {
    return new RedisString(connection, key)
  }
  this.connection = new Redis(connection).connection
  this.key = key
  return this
}

/**
 * @name RedisString.prototype.append
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).append(value string) -> Promise<newLength number>
 * ```
 */
RedisString.prototype.append = function append(value) {
  return this.connection.append(this.key, value)
}

/**
 * @name RedisString.prototype.decr
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).decr() -> valueAfterDecrement Promise<number>
 * ```
 */
RedisString.prototype.decr = function decr() {
  return this.connection.decr(this.key)
}

/**
 * @name RedisString.prototype.decrby
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).decrby(decrement number) -> valueAfterDecrement Promise<number>
 * ```
 */
RedisString.prototype.decrby = function decrby(decrement) {
  return this.connection.decrby(this.key, decrement)
}

/**
 * @name RedisString.prototype.incr
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).incr() -> valueAfterIncrement Promise<number>
 * ```
 */
RedisString.prototype.incr = function incr() {
  return this.connection.incr(this.key)
}

/**
 * @name RedisString.prototype.incrby
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).incrby(increment number) -> valueAfterIncrement Promise<number>
 * ```
 */
RedisString.prototype.incrby = function incrby(increment) {
  return this.connection.incrby(this.key, increment)
}

/**
 * @name RedisString.prototype.get
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).get() -> Promise<string>
 * ```
 */
RedisString.prototype.get = function get(value) {
  return this.connection.get(this.key)
}

/**
 * @name RedisString.prototype.set
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).set(
 *   value string,
 *   ...('EX', seconds number)?,
 *   ...('PX', milliseconds number)?,
 *   ...('KEEPTTL')?,
 *   ...('NX', 'XX')?,
 *   ...('GET')?,
 * ) -> Promise<'OK'|(returnedString string)|null>
 * ```
 */
RedisString.prototype.set = function set(value, ...options) {
  return this.connection.set(this.key, value, ...options)
}

/**
 * @name RedisString.prototype.getset
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).getset(value string) -> Promise<oldValue string>
 * ```
 */
RedisString.prototype.getset = function getset(value) {
  return this.connection.getset(this.key, value)
}

/**
 * @name RedisString.prototype.strlen
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisString(connection, key).strlen() -> length Promise<number>
 * ```
 */
RedisString.prototype.strlen = function strlen() {
  return this.connection.strlen(this.key)
}

module.exports = RedisString
