/**
 * @name DynamoTableScanIterator
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTableScanIterator(
 *   dynamoTable DynamoTable,
 *   options {},
 * ) -> AsyncGenerator<DynamoItem>
 * ```
 */
const DynamoTableScanIterator = async function* (
  dynamoTable, options = {},
) {
  let response = await dynamoTable.scan({ limit: 1000, ...options })
  yield* response.Items
  while (response.LastEvaluatedKey != null) {
    response = await dynamoTable.scan({
      limit: 1000,
      exclusiveStartKey: response.LastEvaluatedKey,
    })
    yield* response.Items
  }
}

module.exports = DynamoTableScanIterator
