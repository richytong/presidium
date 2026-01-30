/**
 * @name arrayPush
 *
 * @docs
 * ```coffeescript [specscript]
 * arrayPush(array Array, item any) -> array
 * ```
 */
const arrayPush = function (array, item) {
  array.push(item)
  return array
}

module.exports = arrayPush
