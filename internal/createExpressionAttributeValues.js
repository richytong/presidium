const Dynamo = require('./Dynamo')

/**
 * @name createExpressionAttributeValues
 *
 * @synopsis
 * ```coffeescript [specscript]
 * createExpressionAttributeValues(options {
 *   values: Object,
 * }) -> Object
 * ```
 */
const createExpressionAttributeValues = function (options) {
  const { values } = options
  const result = {}
  for (const key in values) {
    const value = values[key]
    result[`:${key}`] = Dynamo.AttributeValue(value)
  }
  return result
}

module.exports = createExpressionAttributeValues
