require('rubico/global')
const RetryAwsErrors = require('./RetryAwsErrors')
const dynamoDBStreamGetShardIterator = require('./dynamoDBStreamGetShardIterator')
const dynamoDBStreamGetRecords = require('./dynamoDBStreamGetRecords')
const handleDynamoDBStreamGetRecordsError =
  require('./handleDynamoDBStreamGetRecordsError')
const DynamoDBAttributeValueJSON = require('./DynamoDBAttributeValueJSON')
const sleep = require('./sleep')

/**
 * @name dynamoDBStreamGetRecordsIterator
 *
 * @docs
 * ```coffeescript [specscript]
 * type DynamoDBJSONObject = Object<[key string]: {
 *   ['S'|'N'|'B'|'L'|'M']:
 *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
 * }>
 *
 * stream.dynamoDBStreamGetRecordsIterator(Shard {
 *   ShardId: string,
 *   StreamArn: string,
 * }) -> asyncIterator AsyncIterator<Record {
 *   eventID,
 *   eventName: 'INSERT'|'MODIFY'|'REMOVE',
 *   eventVersion: string,
 *   eventSource: string,
 *   awsRegion: string,
 *   dynamodb: {
 *     ApproximateCreationDateTime: Date,
 *     NewImage: DynamoDBJSONObject,
 *     SequenceNumber: string,
 *     SizeBytes: number,
 *     StreamViewType: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
 *   },
 * }>
 * ```
 */
async function* dynamoDBStreamGetRecordsIterator(options) {
  const dynamoDBStreamGetShardIteratorRetries =
    RetryAwsErrors(dynamoDBStreamGetShardIterator, this)
  const dynamoDBStreamGetRecordsRetries =
    RetryAwsErrors(dynamoDBStreamGetRecords, this)

  const startingShardIterator = await dynamoDBStreamGetShardIteratorRetries({
    ShardId: options.ShardId,
    StreamArn: options.StreamArn,
    ShardIteratorType: this.ShardIteratorType,
  }).then(get('ShardIterator'))

  let getRecordsResponse = await dynamoDBStreamGetRecordsRetries({
    ShardIterator: startingShardIterator,
    Limit: this.GetRecordsLimit,
  }).catch(handleDynamoDBStreamGetRecordsError)

  yield* getRecordsResponse.Records.map(assign({
    Table: this.table,
    ShardId: options.ShardId,
  }))

  while (!this.closed && getRecordsResponse.NextShardIterator != null) {
    await sleep(this.GetRecordsInterval)

    getRecordsResponse = await dynamoDBStreamGetRecordsRetries({
      ShardIterator: getRecordsResponse.NextShardIterator,
      Limit: this.GetRecordsLimit,
    }).catch(handleDynamoDBStreamGetRecordsError)

    yield* getRecordsResponse.Records.map(assign({
      Table: this.table,
      ShardId: options.ShardId,
    }))
  }
}

module.exports = dynamoDBStreamGetRecordsIterator
