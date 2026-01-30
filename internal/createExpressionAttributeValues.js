const DynamoDBAttributeValue = require('./DynamoDBAttributeValue')

/**
 * @name createExpressionAttributeValues
 *
 * @docs
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
    result[`:${key}`] = DynamoDBAttributeValue(value)
  }
  return result
}

module.exports = createExpressionAttributeValues
