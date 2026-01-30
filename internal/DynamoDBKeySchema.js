const getFirstKey = require('./getFirstKey')

/**
 * @name DynamoDBKeySchema
 *
 * @docs
 * ```coffeescript [specscript]
 * type DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * DynamoDBKeySchema(
 *   primaryKeyOrIndex [{ string: DynamoAttributeType }]
 * ) -> [{ AttributeName: string, KeyType: 'HASH' }]
 *
 * DynamoDBKeySchema(
 *   primaryKeyOrIndex [
 *     { string: DynamoAttributeType },
 *     { string: DynamoAttributeType }
 *   ]
 * ) -> [
 *   { AttributeName: string, KeyType: 'HASH' },
 *   { AttributeName: string, KeyType: 'RANGE' }
 * ]
 * ```
 */
function DynamoDBKeySchema(primaryKeyOrIndex) {
  return primaryKeyOrIndex.length == 1 ? [{
    AttributeName: getFirstKey(primaryKeyOrIndex[0]),
    KeyType: 'HASH',
  }] : [{
    AttributeName: getFirstKey(primaryKeyOrIndex[0]),
    KeyType: 'HASH',
  }, {
    AttributeName: getFirstKey(primaryKeyOrIndex[1]),
    KeyType: 'RANGE',
  }]
}

module.exports = DynamoDBKeySchema
