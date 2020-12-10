const thunkify = require('rubico/thunkify')
const IORedis = require('ioredis')
const parseRedisConnectionString = require('./internal/parseRedisConnectionString')

/**
 * @name Redis
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(options string|{
 *   host: string,
 *   port: number,
 *   database: number,
 * })
 * ```
 *
 * @description
 * https://github.com/luin/ioredis/blob/master/API.md
 */
const Redis = function (options) {
  const redis = new IORedis({
    ...typeof options == 'string'
      ? parseRedisConnectionString(options)
      : options,
    keepAlive: 1000,
    lazyConnect: true,
  })
  redis.ready = redis.connect()
  return redis
}

module.exports = Redis
