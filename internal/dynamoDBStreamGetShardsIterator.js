require('rubico/global')
const RetryAwsErrors = require('./RetryAwsErrors')
const dynamoDBStreamDescribeStream = require('./dynamoDBStreamDescribeStream')

/**
 * @name dynamoDBStreamGetShardsIterator
 *
 * @docs
 * ```coffeescript [specscript]
 * dynamoDBStreamGetShardsIterator(options {
 *   StreamArn: string,
 * }) -> asyncIterator AsyncIterator<Shard {
 *   ParentShardId: string,
 *   SequenceNumberRange: {
 *     EndingSequenceNumber: string,
 *     StartingSequenceNumber: string,
 *   },
 *   ShardId: string,
 *   StreamArn: string,
 * }>
 * ```
 */
async function* dynamoDBStreamGetShardsIterator(options) {
  const dynamoDBStreamDescribeStreamRetries =
    RetryAwsErrors(dynamoDBStreamDescribeStream, this)

  let streamData = await dynamoDBStreamDescribeStreamRetries({
    StreamArn: options.StreamArn,
    Limit: 100,
  }).then(get('StreamDescription'))

  if (streamData.Shards.length > 0) {
    yield* streamData.Shards.map(assign({ StreamArn: options.StreamArn }))
  }
  while (!this.closed && streamData.LastEvaluatedShardId != null) {
    await sleep(this.GetShardsInterval)

    streamData = await dynamoDBStreamDescribeStreamRetries({
      StreamArn: options.StreamArn,
      Limit: 100,
      ExclusiveStartShardId: streamData.LastEvaluatedShardId,
    }).then(get('StreamDescription'))

    if (streamData.Shards.length > 0) {
      yield* streamData.Shards.map(assign({ StreamArn: options.StreamArn }))
    }
  }
}

module.exports = dynamoDBStreamGetShardsIterator
