/**
 * @name encodeURIComponentRFC3986
 *
 * @docs
 * ```coffeescript [specscript]
 * encodeURIComponentRFC3986(str string) -> encoded string
 * ```
 */
function encodeURIComponentRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, function(c) {
    return '%' + c.charCodeAt(0).toString(16).toUpperCase()
  })
}

module.exports = encodeURIComponentRFC3986
