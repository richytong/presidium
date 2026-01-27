const getFirstKey = require('./getFirstKey')

/**
 * @name DynamoDBIndexname
 * @static
 *
 * @synopsis
 * ```coffeescript [specscript]
 * type JSONKey = {
 *   [hashKey string]: string|number|binary,
 *   [sortKey string]?: string|number|binary,
 * }
 *
 * DynamoDBIndexname(indexKey JSONKey) -> indexname string
 * ```
 *
 * @description
 * Converts a DynamoDB index key to its indexname.
 *
 * ```javascript
 * console.log(
 *   DynamoDBIndexname([{ name: 'string' }, { createTime: 'number' }]),
 * ) // 'name-createTime-index'
 * ```
 */
function DynamoDBIndexname(indexKey) {
  return `${indexKey.map(getFirstKey).join('-')}-index`
}

module.exports = DynamoDBIndexname
