const thunkify = require('rubico/thunkify')
const IORedis = require('ioredis')
const parseRedisConnectionString = require('./internal/parseRedisConnectionString')

/**
 * @name Redis
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection Redis|IORedis|string|{
 *   host: string,
 *   port: number,
 *   database: number,
 * })
 * ```
 */
const Redis = function (connection) {
  this.redis = connection.constructor == Redis ? connection.redis
    : connection.constructor == IORedis ? connection
    : typeof redis == 'string' ? new IORedis(parseRedisConnectionString(connection))
    : new IORedis(connection)
  this.readyPromise = new Promise(resolve => {
    this.redis.on('ready', thunkify(resolve, this))
  })
  return this
}

/**
 * @name Redis.prototype.ready
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).ready() -> Promise<Redis>
 * ```
 */
Redis.prototype.ready = function ready() {
  return this.readyPromise
}

module.exports = Redis
