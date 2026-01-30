/**
 * @name DynamoDBAttributeType
 *
 * @docs
 * ```coffeescript [specscript]
 * DynamoDBAttributeType(value string) -> 'S'
 * DynamoDBAttributeType(value number) -> 'N'
 * DynamoDBAttributeType(value TypedArray) -> 'B'
 * ```
 */
function DynamoDBAttributeType(value) {
  switch (value) {
    case 'string':
    case 'S':
      return 'S'
    case 'number':
    case 'N':
      return 'N'
    case 'binary':
    case 'B':
      return 'B'
    default:
      throw new TypeError(`Invalid value ${value}`)
  }
}

module.exports = DynamoDBAttributeType
