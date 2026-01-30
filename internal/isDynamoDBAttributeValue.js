/**
 * @name isDynamoDBAttributeValue
 *
 * @docs
 * ```coffeescript [specscript]
 * isDynamoDBAttributeValue(o object) -> boolean
 * ```
 */
function isDynamoDBAttributeValue(o) {
  if (typeof o != 'object') {
    return false
  }
  return (
    'S' in o
    || 'N' in o
    || 'B' in o
    || 'BOOL' in o
    || 'NULL' in o
    || 'M' in o
  )
}

module.exports = isDynamoDBAttributeValue
