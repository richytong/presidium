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
  this.connection = connection.constructor == Redis ? connection.redis
    : connection.constructor == IORedis ? connection
    : typeof redis == 'string' ? new IORedis(parseRedisConnectionString(connection))
    : new IORedis(connection)
  return this
}

module.exports = Redis
