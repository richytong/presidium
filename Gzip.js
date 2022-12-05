const zlib = require('zlib')
const StringStream = require('./internal/StringStream')

/**
 * @name Gzip
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Gzip(raw string) -> gzip stream
 *
 * Gzip() -> gzip stream
 * ```
 *
 * @description
 * ```js
 * const data = { a: 1 }
 *
 * Gzip(JSON.stringify(data)).pipe(response)
 * ```
 */

const Gzip = function (raw) {
  if (raw == null) {
    return zlib.createGzip()
  }
  return StringStream(raw).pipe(zlib.createGzip())
}

module.exports = Gzip
