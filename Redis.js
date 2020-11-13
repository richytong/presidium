const thunkify = require('rubico/thunkify')
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
  this.redis = value.constructor == Redis ? value.redis
    : value.constructor == IORedis ? value
    : typeof redis == 'string' ? new IORedis(parseRedisConnectionString(value))
    : new IORedis(value)
  this.readyPromise = new Promise(resolve => {
    this.redis.on('ready', thunkify(resolve))
  })
  return this
}

/**
 * @name Redis.prototype.ready
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(value).ready() -> Promise<Redis>
 * ```
 */
Redis.prototype.ready = function ready() {
  return this.readyPromise
}

module.exports = Redis
