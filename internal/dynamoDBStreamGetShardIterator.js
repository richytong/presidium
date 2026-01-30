const Readable = require('../Readable')
const AwsError = require('./AwsError')

/**
 * @name dynamoDBStreamGetShardIterator
 *
 * @docs
 * ```coffeescript [specscript]
 * type DynamoDBJSONObject = Object<
 *   { S: string }
 *   |{ N: number }
 *   |{ B: Buffer }
 *   |{ L: Array<DynamoDBJSONObject> }
 *   |{ M: Object<DynamoDBJSONObject> }
 * >
 *
 * dynamoDBStreamGetShardIterator(options {
 *   ShardId: string,
 *   StreamArn: string,
 *   ShardIteratorType: string,
 * }) -> data Promise<{ ShardIterator: string }>
 * ```
 */
async function dynamoDBStreamGetShardIterator(options) {
  const payload = JSON.stringify({
    ShardId: options.ShardId,
    StreamArn: options.StreamArn,
    ShardIteratorType: options.ShardIteratorType,
  })

  const response = await this._awsDynamoDBStreamsRequest(
    'POST',
    '/',
    'GetShardIterator',
    payload,
  )

  if (response.ok) {
    const data = await Readable.JSON(response)
    return data
  }

  throw new AwsError(await Readable.Text(response), response.status)
}

module.exports = dynamoDBStreamGetShardIterator
