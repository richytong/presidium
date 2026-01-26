const isDynamoDBAttributeValue = require('./isDynamoDBAttributeValue')

/**
 * @name isDynamoDBJSON
 *
 * @docs
 * ```coffeescript [specscript]
 * isDynamoDBJSON(o Object) -> boolean
 * ```
 */
function isDynamoDBJSON(o) {
  if (typeof o != 'object') {
    return false
  }
  for (const key in o) {
    const value = o[key]
    if (isDynamoDBAttributeValue(value)) {
      continue
    }
    return false
  }
  return true
}

module.exports = isDynamoDBJSON
