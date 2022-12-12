/**
 * @name StrictValidator
 *
 * ```coffeescript [specscript]
 * StrictValidator(
 *   parsers Object<function>,
 *   options: {
 *     onMissing?: function,
 *   },
 * ) -> validator (object Object)=>(validated Object)
 * ```
 */
const StrictValidator = function (parsers, options = {}) {
  const {
    onMissing = function throwOnMissing(field) {
      const error = new Error(`missing field ${field}`)
      error.code = 400
      throw error
    },
  } = options

  const requiredFields = Object.keys(parsers)

  return function strictValidator(object) {
    for (const field of requiredFields) {
      if (!(field in object)) {
        onMissing(field)
      }
    }

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

module.exports = StrictValidator
