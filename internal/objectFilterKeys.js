/**
 * @name objectFilterKeys
 *
 * @docs
 * ```coffeescript [specscript]
 * objectFilterKeys(object Object, predicate function) -> filteredObject Object
 * ```
 *
 * @TODO handle async
 */
const objectFilterKeys = function (object, predicate) {
  const result = {}
  for (const key in object) {
    if (predicate(key)) {
      result[key] = object[key]
    }
  }
  return result
}

module.exports = objectFilterKeys
