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
 * RedisString(connection, key).append(value string)
 * ```
 */
RedisString.prototype.append = function append(value) {
  return this.connection.append(this.key, value)
}

module.exports = RedisString
