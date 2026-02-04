/**
 * @name OptionalValidator
 *
 * @docs
 * ```coffeescript [specscript]
 * type ParserValidator = (input any)=>(parsedValidatedInput any)
 *
 * type ParserValidatorSchema = Object<parserValidator ParserValidator>
 *
 * type Validator = (data Object<input any>)=>(parsedValidatedData Object<parsedValidatedInput any>)
 *
 * OptionalValidator(
 *   parserValidatorSchema ParserValidatorSchema
 * ) -> optionalValidator Validator
 * ```
 *
 * Creates an optional validator. An optional validator validates each field of a `data` object with the corresponding `parserValidator` function. An optional validator does not throw an error if any of the optional fields specified by the `parserValidatorSchema` are missing.
 *
 * Arguments:
 *   * `parserValidatorSchema` - an object of parser validator functions.
 *     * `parserValidator` - a function that both parses and validates input. The `parserValidator` function should throw an error for invalid input.
 *
 * Return:
 *   * `optionalValidator` - the optional validator. 
 *
 * ```javascript
 * const validator = OptionalValidator({
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
 * const validatedData2 = validator(data2)
 * console.log(validatedData2) // { name: 'Name', count: 3 }
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
