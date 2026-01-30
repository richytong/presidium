/**
 * @name OptionalValidator
 *
 * @docs
 * ```coffeescript [specscript]
 * OptionalValidator(parsers Object<function>)
 *   -> optionalValidator (object Object)=>(validated Object)
 * ```
 */

const OptionalValidator = function (parsers) {
  const fields = Object.keys(parsers)

  return function optionalValidator(object) {
    const result = {}
    for (const key in parsers) {
      const parser = parsers[key],
        value = object[key]
      if (value != null) {
        result[key] = parser(value)
      }
    }
    return result
  }
}

module.exports = OptionalValidator
