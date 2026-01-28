const Readable = require('../Readable')
const AwsError = require('./AwsError')

/**
 * @name dynamoDBStreamGetRecords
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
 * dynamoDBStreamGetRecords(options {
 *   ShardIterator: string,
 *   Limit: number,
 * }) -> data Promise<{
 *   NextShardIterator: string,
 *   Records: Array<{
 *     awsRegion: string,
 *     dynamodb: {
 *       Keys: DynamoDBJSONObject,
 *       NewImage: DynamoDBJSONObject,
 *       OldImage: DynamoDBJSONObject,
 *       SequenceNumber: string,
 *       SizeBytes: number,
 *       StreamViewType: string,
 *     },
 *     eventID: string,
 *     eventName: string,
 *     eventSource: string,
 *     eventVersion: string,
 *   }>,
 * }>
 * ```
 */
async function dynamoDBStreamGetRecords(options) {
  const payload = JSON.stringify({
    ShardIterator: options.ShardIterator,
    Limit: options.Limit
  })

  const response = await this._awsDynamoDBStreamsRequest(
    'POST',
    '/',
    'GetRecords',
    payload,
  )

  if (response.ok) {
    const data = await Readable.JSON(response)
    return data
  }

  throw new AwsError(await Readable.Text(response), response.status)
}

module.exports = dynamoDBStreamGetRecords
