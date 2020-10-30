const pipe = require('rubico/pipe')

// pattern RegExp => value string => matches object
const match = pattern => value => value.match(pattern)

/**
 * @name parseRedisConnectionString
 *
 * @synopsis
 * parseRedisConnectionString(connectionString string) -> connection {
 *  host: string,
 *  port: string,
 *  database,
 * }
 *
 * @description
 * Parse the redis connection string. Understands `{ host, port, database }`.
 *
 * ```javascript
 * console.log(
 *   parseRedisConnectionString('redis://localhost:6379/100')
 * ) // { host: 'localhost', port: 6379, database: 100 }
 * ```
 */
const parseRedisConnectionString = pipe([
  match(/redis:\/\/(\w[-_\.\w]*)(:\d+)?(\/\d+)?/),
  ([match, host, port, database]) => ({
    host: host == null ? '127.0.0.1' : host,
    port: port == null ? 6379 : Number(port.slice(1)),
    database: database == null ? 0 : Number(database.slice(1)),
  }),
])

module.exports = parseRedisConnectionString
