const Readable = require('../Readable')
const AwsError = require('./AwsError')

/**
 * @name dynamoDBStreamDescribeStream
 *
 * @docs
 * ```coffeescript [specscript]
 * dynamoDBStreamDescribeStream(options {
 *   StreamArn: string,
 *   Limit: number,
 *   ExclusiveStartShardId: string,
 * }) -> streamData Promise<{
 *   StreamDescription: {
 *     KeySchema: [
 *       { AttributeName: string, KeyType: string },
 *       { AttributeName: string, KeyType: string },
 *     ],
 *     LastEvaluatedShardId: string,
 *     Shards: Array<{
 *       ParentShardId: string,
 *       SequenceNumberRange: {
 *         EndingSequenceNumber: string,
 *         StartingSequenceNumber: string,
 *       },
 *       ShardId: string,
 *     }>,
 *     StreamArn: string,
 *     StreamLabel: string, # ISO 8601 Date string
 *     StreamStatus: string,
 *     StreamViewType: string,
 *     TableName: string,
 *   },
 * }>
 * ```
 */
async function dynamoDBStreamDescribeStream(options) {
  const payload = JSON.stringify({
    StreamArn: options.StreamArn,
    Limit: options.Limit,
    ExclusiveStartShardId: options.ExclusiveStartShardId,
  })

  const response = await this._awsDynamoDBStreamsRequest(
    'POST',
    '/',
    'DescribeStream',
    payload,
  )

  if (response.ok) {
    const data = await Readable.JSON(response)
    return data
  }

  throw new AwsError(await Readable.Text(response), response.status)
}

module.exports = dynamoDBStreamDescribeStream
