require('rubico/global')
const getFirstKey = require('./getFirstKey')

/**
 * @name DynamoDBAttributeValueJSON
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
 * DynamoDBAttributeValueJSON(AttributeValue DynamoAttributeValue)
 *   -> json string|number|boolean|Array|Object
 * ```
 */
function DynamoDBAttributeValueJSON(AttributeValue) {
  switch (getFirstKey(AttributeValue)) {
    case 'S':
      return String(AttributeValue.S)
    case 'N':
      return Number(AttributeValue.N)
    case 'BOOL':
      return Boolean(AttributeValue.BOOL)
    case 'NULL':
      return null
    case 'L':
      return AttributeValue.L.map(DynamoDBAttributeValueJSON)
    case 'M':
      return map(AttributeValue.M, DynamoDBAttributeValueJSON)
    default:
      throw new TypeError(`Invalid AttributeValue ${AttributeValue}`)
  }
}

module.exports = DynamoDBAttributeValueJSON
