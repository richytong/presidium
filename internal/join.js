/**
 * @name join
 *
 * @docs
 * ```coffeescript [specscript]
 * join(delimiter string)(array Array) -> joined string
 * ```
 */
const join = delimiter => function joining(array) {
  return array.join(delimiter)
}

module.exports = join
