/**
 * @name AmzCanonicalHeaders
 *
 * @synopsis
 * ```coffeescript [specscript]
 * AmzCanonicalHeaders(headers Object) -> canonicalHeaders string
 * ```
 */
const AmzCanonicalHeaders = function (headers) {
  let canonicalHeaders = ''
  for (const key in headers) {
    const value = headers[key]
    canonicalHeaders += `${key.toLowerCase()}:${value}\n`
  }
  return canonicalHeaders
}

module.exports = AmzCanonicalHeaders
