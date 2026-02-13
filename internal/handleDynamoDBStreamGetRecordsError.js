/**
 * @name handleDynamoDBStreamGetRecordsError
 *
 * @docs
 * ```coffeescript [specscript]
 * handleDynamoDBStreamGetRecordsError(error Error) -> []
 * ```
 */
function handleDynamoDBStreamGetRecordsError(error) {
  if (error.message.includes('Shard iterator has expired')) {
    return { Records: [] }
  }
  throw error
}

module.exports = handleDynamoDBStreamGetRecordsError
