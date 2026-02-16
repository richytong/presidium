/**
 * @name StrictValidator
 *
 * @docs
 * ```coffeescript [specscript]
 * type ParserValidator = (input any)=>(parsedValidatedInput any)
 *
 * type ParserValidatorSchema = Object<parserValidator ParserValidator>
 *
 * type Validator = (data Object<input any>)=>(parsedValidatedData Object<parsedValidatedInput any>)
 *
 * StrictValidator(
 *   parserValidatorSchema ParserValidatorSchema
 * ) -> strictValidator Validator
 * ```
 *
 * Creates a strict validator. A strict validator validates each field of a `data` object with the corresponding `parserValidator` function. A strict validator throws an error if any of the required fields specified by the `parserValidatorSchema` are missing (not in the data object).
 *
 * Arguments:
 *   * `parserValidatorSchema` - an object of parser validator functions.
 *     * `parserValidator` - a function that both parses and validates input. The `parserValidator` function should throw an error for invalid input.
 *
 * Return:
 *   * `strictValidator` - the strict validator. 
 *
 * ```javascript
 * const validator = StrictValidator({
 *   name: String,
 *   count: Number,
 *   email: input => {
 *     if (!input.includes('@')) {
 *       throw new Error('Invalid email')
 *     }
 *     return input
 *   },
 * })
 *
 * const data1 = {
 *   name: 'Name',
 *   count: 3,
 *   email: 'test@example.com',
 * }
 *
 * const validatedData1 = validator(data1)
 * console.log(validatedData1) // { name: 'Name', count: 3, email: 'test@example.com' }
 *
 * const data2 = {
 *   name: 'Name',
 *   count: 3,
 * }
 *
 * const validatedData2 = validator(data2) // throws Error: missing field email
 *
 * const data3 = {
 *   name: 'Name',
 *   count: 3,
 *   email: 'invalidemail',
 * }
 *
 * const validatedData3 = validator(data3) // throws Error: Invalid email
 * ```
 */
const StrictValidator = function (parsers, options = {}) {
  const {
    onMissing
  } = options

  const requiredFields = Object.keys(parsers)

  return function strictValidator(object) {
    const result = {}
    for (const field in parsers) {
      if (field in object) {
        const parser = parsers[field]
        const value = object[field]
        result[field] = parser(value)

      } else if (typeof onMissing == 'function') {
        onMissing(field)
      } else {
        const error = new Error(`Missing field ${field}`)
        error.code = 400
        throw error
      }
    }

    return result
  }
}

module.exports = StrictValidator
