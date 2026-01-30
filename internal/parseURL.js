/**
 * @name parseURL
 *
 * @docs
 * ```coffeescript [specscript]
 * parseURL(s string) -> url URL
 * ```
 */
function parseURL(s) {
  if (s.startsWith('/')) {
    return new URL(`http://*${s}`)
  }
  return new URL(s)
}

module.exports = parseURL
