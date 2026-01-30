/**
 * @name AmzCanonicalHeaders
 *
 * @docs
 * ```coffeescript [specscript]
 * AmzCanonicalHeaders(headers Object) -> canonicalHeaders string
 * ```
 */
const AmzCanonicalHeaders = function (headers) {
  const sortedHeaders =
    Object.entries(headers)
    .map(([k, v]) => [k.toLowerCase(), v])
    .sort((a, b) => a[0] > b[0] ? 1 : -1)

  const canonicalHeaders =
    sortedHeaders
    .map(([k, v]) => `${k}:${v}`)
    .join('\n') + '\n'

  return canonicalHeaders
}

module.exports = AmzCanonicalHeaders
