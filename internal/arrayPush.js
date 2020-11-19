/**
 * @name arrayPush
 *
 * @synopsis
 * ```coffeescript [specscript]
 * arrayPush(array Array, item any) -> array
 * ```
 */
const arrayPush = function (array, item) {
  array.push(item)
  return array
}

module.exports = arrayPush
