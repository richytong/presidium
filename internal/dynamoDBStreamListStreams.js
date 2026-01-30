const Readable = require('../Readable')
const AwsError = require('./AwsError')

/**
 * @name dynamoDBStreamListStreams
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
 * dynamoDBStreamListStreams(options {
 *   TableName: string,
 *   Limit: number,
 *   ExclusiveStartStreamArn: string,
 * }) -> data Promise<{
 *   LastEvaluatedStreamArn: string,
 *   Streams: Array<{
 *     StreamArn: string,
 *     StreamLabel: string, # ISO 8601 Date string
 *     TableName: string,
 *   }>,
 * }>
 * ```
 */
async function dynamoDBStreamListStreams(options) {
  const payload = JSON.stringify({
    TableName: options.TableName,
    Limit: options.Limit,
    ExclusiveStartStreamArn: options.ExclusiveStartStreamArn,
  })

  const response = await this._awsDynamoDBStreamsRequest(
    'POST',
    '/',
    'ListStreams',
    payload,
  )

  if (response.ok) {
    const data = await Readable.JSON(response)
    return data
  }

  throw new AwsError(await Readable.Text(response), response.status)
}

module.exports = dynamoDBStreamListStreams
