const pipe = require('rubico/pipe')
const curry = require('rubico/curry')
const __ = require('rubico/__')

// (expression RegExp, value string) => execResult object
const exec = (expression, value) => expression.exec(value)

/**
 * @name parseRedisConnectionString
 *
 * @synopsis
 * parseRedisConnectionString(connectionString string) -> connection {
 *  host: string,
 *  port: string,
 *  db: number,
 * }
 *
 * @description
 * Parse the redis connection string. Understands `{ host, port, db }`.
 *
 * ```javascript
 * console.log(
 *   parseRedisConnectionString('redis://localhost:6379/100')
 * ) // { host: 'localhost', port: 6379, db: 15 }
 * ```
 */
const parseRedisConnectionString = pipe([
  curry(exec, /redis:\/\/(?<host>\w[-_.\w]*)(?<port>:\d+)?(?<db>\/\d+)?/, __),
  ({ groups: { host, port, db } }) => ({
    host: host == null ? '127.0.0.1' : host,
    port: port == null ? 6379 : Number(port.slice(1)),
    db: db == null ? 0 : Number(db.slice(1)),
  }),
])

module.exports = parseRedisConnectionString
