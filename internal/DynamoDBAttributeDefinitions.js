require('rubico/global')
const getFirstKey = require('./getFirstKey')
const getFirstValue = require('./getFirstValue')
const DynamoDBAttributeType = require('./DynamoDBAttributeType')

/**
 * @name DynamoDBAttributeDefinitions
 * @static
 *
 * @docs
 * ```coffeescript [specscript]
 * type DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * DynamoDBAttributeDefinitions(
 *   primaryKeyOrIndex Array<Object<DynamoAttributeType>>
 * ) -> Array<{ AttributeName: string, AttributeType: any }>
 * ```
 */
function DynamoDBAttributeDefinitions(primaryKeyOrIndex) {
  return primaryKeyOrIndex.map(all({
    AttributeName: getFirstKey,
    AttributeType: pipe([
      getFirstValue,
      DynamoDBAttributeType,
    ]),
  }))
}

module.exports = DynamoDBAttributeDefinitions
