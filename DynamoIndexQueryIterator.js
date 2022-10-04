/**
 * @name DynamoIndexQueryIterator
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndexQueryIterator(
 *   dynamoIndex DynamoIndex,
 *   keyConditionExpression string,
 *   queryValues object,
 *   options? {
 *     limit?: number,
 *     scanIndexForward?: boolean, // true for ASC, false for DESC
 *   },
 * ) -> AsyncGenerator<DynamoItem>
 * ```
 */
const DynamoIndexQueryIterator = async function* (
  dynamoIndex, keyConditionExpression, queryValues, options = {}
) {
  const {
    limit = 1000,
    scanIndexForward = true,
  } = options

  let response = await dynamoIndex.query(
    keyConditionExpression,
    queryValues,
    { limit, scanIndexForward },
  )
  yield* response.Items

  while (response.LastEvaluatedKey != null) {
    response = await dynamoIndex.query(
      keyConditionExpression,
      queryValues,
      {
        limit,
        scanIndexForward,
        exclusiveStartKey: response.LastEvaluatedKey,
      },
    )
    yield* response.Items
  }
}

module.exports = DynamoIndexQueryIterator
