require('rubico/global')

/**
 * @name DynamoDBAttributeValue
 *
 * @docs
 * ```coffeescript [specscript]
 * DynamoAttributeValue = {
 *   S: string,
 *   N: string,
 *   BOOL: boolean,
 *   NULL: boolean,
 *   L: Array<DynamoAttributeValue>,
 *   M: Object<DynamoAttributeValue>,
 * }
 *
 * DynamoDBAttributeValue(value any) -> DynamoAttributeValue
 * ```
 */
function DynamoDBAttributeValue(value) {
  if (Array.isArray(value)) {
    return { L: value.map(DynamoDBAttributeValue) }
  }
  if (typeof value == 'string') {
    return { S: value }
  }
  if (typeof value == 'number' && !isNaN(value)) {
    return { N: value.toString(10) }
  }
  if (typeof value == 'boolean') {
    return { BOOL: value }
  }
  if (value == null) {
    return { NULL: true }
  }
  if (value.constructor == Object) {
    return { M: map(value, DynamoDBAttributeValue) }
  }
  throw new TypeError(`Invalid value ${value}`)
}

module.exports = DynamoDBAttributeValue
