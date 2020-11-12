const IORedis = require('ioredis')
const parseRedisConnectionString = require('./internal/parseRedisConnectionString')

/**
 * @name Redis
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(value Redis|IORedis|string|{
 *   host: string,
 *   port: number,
 *   database: number,
 * })
 * ```
 */
const Redis = function (value) {
  if (this == null || this.constructor != Redis) {
    return new Redis(value)
  }
  this.redis = value.constructor == Redis ? value.redis
    : value.constructor == IORedis ? value
    : typeof redis == 'string' ? new IORedis(parseRedisConnectionString(value))
    : new IORedis(value)
  return this
}

module.exports = Redis
