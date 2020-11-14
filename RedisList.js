const Redis = require('./Redis')

/**
 * @name RedisList
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connec)
 * ```
 */
const RedisList = function (connection, key) {
  if (this == null || this.constructor != RedisList) {
    return new RedisList(connection, key)
  }
  this.connection = new Redis(connection).connection
  this.key = key
  return this
}

/**
 * @name RedisList.prototype.blpop
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).blpop(blockSeconds number) -> Promise<firstItem string>
 * ```
 */
RedisList.prototype.blpop = function blpop(blockSeconds) {
  return this.connection.blpop(this.key, blockSeconds)
}

/**
 * @name RedisList.prototype.brpop
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).brpop(blockSeconds number) -> Promise<lastItem string>
 * ```
 */
RedisList.prototype.brpop = function brpop(blockSeconds) {
  return this.connection.brpop(this.key, blockSeconds)
}

/**
 * @name RedisList.prototype.lindex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lindex(index number) -> Promise<itemAtIndex string>
 * ```
 */
RedisList.prototype.lindex = function lindex(index) {
  return this.connection.lindex(this.key, index)
}

/**
 * @name RedisList.prototype.linsert
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).linsert(
 *   'BEFORE'|'AFTER',
 *   pivot string,
 *   value string,
 * ) -> Promise<newListLength number>
 * ```
 */
RedisList.prototype.linsert = function linsert(beforeOrAfter, pivot, value) {
  return this.connection.linsert(this.key, beforeOrAfter, pivot, value)
}

/**
 * @name RedisList.prototype.llen
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).llen() -> Promise<listLength number>
 * ```
 */
RedisList.prototype.llen = function llen() {
  return this.connection.llen(this.key)
}

/**
 * @name RedisList.prototype.lpop
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lpop() -> Promise<item0 string>
 * ```
 *
 * @description
 * Return element stored at index 0 of a list
 */
RedisList.prototype.lpop = function lpop() {
  return this.connection.lpop(this.key)
}

/**
 * @name RedisList.prototype.lpos
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lpos(
 *   item string,
 *   ('RANK', rank number)?,
 *   ('COUNT', numMatches number)?,
 * ) -> Promise<indexOrArrayOfIndexes number|Array<number>|null>
 * ```
 *
 * @description
 * `RANK -n` - invert search direction
 * `COUNT 0` - return array of all matching indexes
 */
RedisList.prototype.lpos = function lpos() {
  return this.connection.lpos(this.key)
}

/**
 * @name RedisList.prototype.lpush
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lpush(item string) -> Promise<listLength number>
 * ```
 *
 * @description
 * Add items reversed to head of list
 */
RedisList.prototype.lpush = function lpush(item, ...moreItems) {
  return this.connection.lpush(this.key, item, ...moreItems)
}

/**
 * @name RedisList.prototype.lpushx
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lpushx(item string) -> Promise<listLength number>
 * ```
 *
 * @description
 * Like lpush but no operation if key does not yet exist
 */
RedisList.prototype.lpushx = function lpushx(item, ...moreItems) {
  return this.connection.lpushx(this.key, item, ...moreItems)
}

/**
 * @name RedisList.prototype.lrange
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lrange(
 *   start number,
 *   stop number,
 * ) -> items Promise<Array<string>>
 * ```
 *
 * @description
 * `start` and `stop` are inclusive
 */
RedisList.prototype.lrange = function lrange(start, stop) {
  return this.connection.lrange(this.key, start, stop)
}

/**
 * @name RedisList.prototype.lrem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lrem(
 *   count number,
 *   item string,
 * ) -> Promise<numRemovedItems number>
 * ```
 *
 * @description
 * Remove `count` occurences of `item` in a list
 */
RedisList.prototype.lrem = function lrem(count, item) {
  return this.connection.lrem(this.key, count, item)
}

/**
 * @name RedisList.prototype.lset
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).lset(
 *   index number,
 *   item string,
 * ) -> Promise<'OK'>
 * ```
 *
 * @description
 * Set item at index in a list
 */
RedisList.prototype.lset = function lset(index, item) {
  return this.connection.lset(this.key, index, item)
}

/**
 * @name RedisList.prototype.ltrim
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).ltrim(
 *   start number,
 *   stop number,
 * ) -> Promise<'OK'>
 * ```
 *
 * @description
 * Trim a list to only the values between start stop inclusive
 */
RedisList.prototype.ltrim = function ltrim(start, stop) {
  return this.connection.ltrim(this.key, start, stop)
}

/**
 * @name RedisList.prototype.rpop
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).rpop() -> Promise<item0 string>
 * ```
 *
 * @description
 * Return item stored at last index of a list
 */
RedisList.prototype.rpop = function rpop() {
  return this.connection.rpop(this.key)
}

/**
 * @name RedisList.prototype.rpush
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).rpush(item string) -> Promise<listLength number>
 * ```
 *
 * @description
 * Add items (in order) to tail of list
 */
RedisList.prototype.rpush = function rpush(item, ...moreItems) {
  return this.connection.rpush(this.key, item, ...moreItems)
}

/**
 * @name RedisList.prototype.rpushx
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RedisList(connection, key).rpushx(item string) -> Promise<listLength number>
 * ```
 *
 * @description
 * Like rpush but no operation if key does not yet exist
 */
RedisList.prototype.rpushx = function rpushx(item, ...moreItems) {
  return this.connection.rpushx(this.key, item, ...moreItems)
}

module.exports = RedisList
