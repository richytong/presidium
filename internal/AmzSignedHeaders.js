/**
 * @name AmzSignedHeaders
 *
 * @docs
 * ```coffeescript [specscript]
 * AmzSignedHeaders(headers Object) -> amzSignedHeaders string
 * ```
 */
const AmzSignedHeaders = function (headers) {
  return Object.keys(headers).map(key => key.toLowerCase()).sort().join(';')
}

module.exports = AmzSignedHeaders
