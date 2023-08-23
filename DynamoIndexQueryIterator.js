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
 *     batchLimit?: number,
 *     limit?: number,
 *   },
 * ) -> AsyncGenerator<DynamoItem>
 * ```
 */
const DynamoIndexQueryIterator = async function* (
  dynamoIndex, keyConditionExpression, queryValues, options = {}
) {
  const {
    batchLimit = 1000,
    limit = Infinity,
  } = options

  let numYielded = 0
  let response = await dynamoIndex.query(
    keyConditionExpression,
    queryValues,
    { ...options, limit: Math.min(batchLimit, limit - numYielded) },
  )
  yield* response.Items
  numYielded += response.Items.length

  while (response.LastEvaluatedKey != null && numYielded < limit) {
    response = await dynamoIndex.query(
      keyConditionExpression,
      queryValues,
      {
        ...options,
        limit: Math.min(batchLimit, limit - numYielded),
        exclusiveStartKey: response.LastEvaluatedKey,
      },
    )
    yield* response.Items
    numYielded += response.Items.length
  }
}

module.exports = DynamoIndexQueryIterator
