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
  if (this == null || this.constructor != Redis) {
    return new Redis(connection)
  }
  if (connection.constructor == Redis) {
    this.connection = connection.connection
  } else if (connection.constructor == IORedis) {
    this.connection = connection
  } else if (typeof connection == 'string') {
    this.connection = new IORedis({
      ...parseRedisConnectionString(connection),
      keepAlive: 1000,
    })
  } else {
    this.connection = new IORedis({ keepAlive: 1000, ...connection })
  }
  return this
}

/**
 * @name Redis.prototype.expire
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).expire(
 *   key string,
 *   seconds number,
 * ) -> status Promise<'1'|'0'>
 * ```
 *
 * @description
 * Expire a key. Returns `1` if timeout was set, `0` if key does not exist.
 */
Redis.prototype.expire = function expire(key, seconds) {
  return this.connection.expire(key, seconds)
}

/**
 * @name Redis.prototype.expireat
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).expireat(
 *   key string,
 *   secondsTimestamp number,
 * ) -> status Promise<'1'|'0'>
 * ```
 */
Redis.prototype.expireat = function expireat(key, secondsTimestamp) {
  return this.connection.expireat(key, secondsTimestamp)
}

Redis.prototype.pexpire = function pexpire(key, millis) {
  return this.connection.pexpire(key, millis)
}

Redis.prototype.pexpireat = function pexpireat(key, millisTimestamp) {
  return this.connection.pexpireat(key, millisTimestamp)
}

Redis.prototype.persist = function persist(key) {
  return this.connection.persist(key)
}

Redis.prototype.ttl = function ttl(key) {
  return this.connection.ttl(key)
}

/**
 * @name Redis.prototype.pttl
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).pttl(key) -> timeToLiveMillis number
 * ```
 */
Redis.prototype.pttl = function pttl(key) {
  return this.connection.pttl(key)
}

/**
 * @name Redis.prototype.type
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).type(key string) -> Promise<'string'|'list'|'set'|'zset'|'hash'|'stream'>
 * ```
 */
Redis.prototype.type = function type(key) {
  return this.connection.type(key)
}

/**
 * @name Redis.prototype.scan
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).scan(
 *   cursor string,
 *   ('MATCH', pattern string)?,
 *   ('COUNT', count number)?,
 *   ('TYPE', type 'string'|'list'|'set'|'zset'|'hash'|'stream')?,
 * ) -> [nextCursor string, elements Array]
 * ```
 */
Redis.prototype.scan = function scan(cursor, ...options) {
  return this.connection.scan(cursor, ...options)
}

/**
 * @name Redis.prototype.del
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).del(key string, ...moreKeys) -> numKeysDeleted Promise<number>
 * ```
 */
Redis.prototype.del = function del(key, ...moreKeys) {
  return this.connection.del(key, ...moreKeys)
}

/**
 * @name Redis.prototype.unlink
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).unlink(key string, ...moreKeys) -> numKeysUnlinked Promise<number>
 * ```
 *
 * @description
 * Like `del` but reclaims memory asynchronously (non-blocking).
 */
Redis.prototype.unlink = function unlink(key, ...moreKeys) {
  return this.connection.unlink(key, ...moreKeys)
}

/**
 * @name Redis.prototype.dump
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).dump(key string) -> redisSerialized string
 * ```
 */
Redis.prototype.dump = function dump(key) {
  return this.connection.dump(key)
}

/**
 * @name Redis.prototype.restore
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Redis(connection).restore(
 *   key string,
 *   ttlMs number,
 *   redisSerializedValue string,
 *   'REPLACE'?,
 *   'ABSTTL'?,
 *   ('IDLETIME', seconds number)?,
 *   ('FREQ', frequency number)?,
 * ) -> redisSerialized string
 * ```
 *
 * @description
 * Use `0` for `ttlMs` to persist key.
 */
Redis.prototype.restore = function restore(
  key, ttlMs, redisSerializedValue, ...options
) {
  return this.connection.restore(key, ttlMs, redisSerializedValue, ...options)
}

module.exports = Redis
