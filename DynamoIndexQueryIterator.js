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
  dynamoIndex, keyConditionExpression, queryValues, queryOptions = {}
) {
  const defaultLimit = 1000

  let response = await dynamoIndex.query(
    keyConditionExpression,
    queryValues,
    { limit: defaultLimit, ...queryOptions },
  )
  yield* response.Items

  while (response.LastEvaluatedKey != null) {
    response = await dynamoIndex.query(
      keyConditionExpression,
      queryValues,
      {
        limit: defaultLimit,
        exclusiveStartKey: response.LastEvaluatedKey,
        ...queryOptions,
      },
    )
    yield* response.Items
  }
}

module.exports = DynamoIndexQueryIterator
