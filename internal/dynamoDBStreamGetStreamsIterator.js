const RetryAwsErrors = require('./RetryAwsErrors')
const dynamoDBStreamListStreams = require('./dynamoDBStreamListStreams')

/**
 * @name dynamoDBStreamGetStreamsIterator
 *
 * @docs
 * ```coffeescript [specscript]
 * dynamoDBStreamGetStreamsIterator()
 *   -> asyncIterator AsyncIterator<Stream { StreamArn: string }>
 * ```
 */
async function* dynamoDBStreamGetStreamsIterator() {
  const dynamoDBStreamListStreamsRetries =
    RetryAwsErrors(dynamoDBStreamListStreams, this)

  let streams = await dynamoDBStreamListStreamsRetries({
    Limit: this.ListStreamsLimit,
    TableName: this.table,
  })

  yield* streams.Streams
  while (!this.closed && streams.LastEvaluatedStreamArn != null) {
    streams = await dynamoDBStreamListStreamsRetries({
      Limit: this.ListStreamsLimit,
      TableName: this.table,
      ExclusiveStartStreamArn: streams.LastEvaluatedStreamArn,
    })

    yield* streams.Streams
  }
}

module.exports = dynamoDBStreamGetStreamsIterator
