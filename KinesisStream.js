const Kinesis = require('./Kinesis')
const rubico = require('rubico')
const has = require('rubico/x/has')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

/**
 * @name KinesisStream
 *
 * @synopsis
 * ```coffeescript [specscript]
 * KinesisStream(options {
 *   name: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   shardFilterType: 'AFTER_SHARD_ID'|'AT_TRIM_HORIZON'|'FROM_TRIM_HORIZON'|'AT_LATEST'|'AT_TIMESTAMP'|'FROM_TIMESTAMP',
 *   shardFilterShardId: string,
 *   shardFilterTimestamp: Date|string|number,
 *   streamCreationTimestamp: Date|string|number, // distinguishes streams of same name e.g. after deleting
 * }) -> KinesisStream
 * ```
 *
 * @description
 * Creates a Kinesis stream. https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html
 */
const KinesisStream = function (options) {
  if (this == null || this.constructor != KinesisStream) {
    return new KinesisStream(options)
  }
  this.name = options.name
  this.shardIteratorType = options.shardIteratorType ?? 'TRIM_HORIZON'
  this.shardIteratorTimestamp = options.shardIteratorTimestamp
  this.shardFilterType = options.shardFilterType
  this.shardFilterShardId = options.shardFilterShardId
  this.shardFilterTimestamp = options.shardFilterTimestamp
  this.streamCreationTimestamp = options.streamCreationTimestamp
  this.listShardsLimit = options.lstShardsLimit ?? 10000
  this.getRecordsLimit = options.getRecordsLimit ?? 10000
  this.kinesis = new Kinesis(omit(['name'])(options))

  this.ready = this.kinesis.client.describeStream({
    StreamName: this.name,
    Limit: 100,
    ...options.exclusiveStartShardId && {
      ExclusiveStartShardId: options.exclusiveStartShardId,
    },
  }).promise().then(async () => {
    await this.kinesis.client.waitFor('streamExists', {
      StreamName: this.name
    }).promise()
  }).catch(async () => {
    await this.kinesis.client.createStream({
      StreamName: this.name,
      ShardCount: 1,
    }).promise()
    await this.kinesis.client.waitFor('streamExists', {
      StreamName: this.name
    }).promise()
  })
  return this
}

/**
 * @name KinesisStream.prototype.delete
 *
 * @synopsis
 * ```coffeescript [specscript]
 * KinesisStream(options).delete() -> Promise<{}>
 * ```
 */
KinesisStream.prototype.delete = function deleteStream() {
  return this.kinesis.client.deleteStream({ StreamName: this.name }).promise()
}

/**
 * @name KinesisStream.prototype.putRecord
 *
 * @synopsis
 * ```coffeescript [specscript]
 * KinesisStream(options).putRecord(
 *   data string|binary,
 *   options {
 *     partitionKey: string, // input to aws hash function to determine which shard
 *     explicitHashKey: string, // skips aws hash function to determine which shard
 *     sequenceNumberForOrdering: string, // guarantees strictly increasing sequence numbers for the same client and partition key
 *   },
 * ) -> Promise<{
 *   ShardId: 'shardId-000000000000',
 *   SequenceNumber: '49613815999932891962088761882213262404258455684913299458'
 * }>
 * ```
 */
KinesisStream.prototype.putRecord = async function putRecord(data, options = {}) {
  await this.ready
  return this.kinesis.client.putRecord({
    StreamName: this.name,
    Data: data,
    PartitionKey: options.partitionKey ?? data.slice(0, 255),
    ...options.explicitHashKey && {
      ExplicitHashKey: options.explicitHashKey,
    },
    ...options.sequenceNumberForOrdering && {
      SequenceNumberForOrdering: options.sequenceNumberForOrdering,
    },
  }).promise()
}

// TODO KinesisStream.prototype.putRecords = async function putRecords() {}

// TODO KinesisStream.prototype.splitShard = async function splitShard() {}

/**
 * @name KinesisStream.prototype.updateShardCount
 *
 * @synopsis
 * ```coffeescript [specscript]
 * KinesisStream(options).updateShardCount(count number) -> Promise<{
 *   StreamName: string,
 *   CurrentShardCount: number,
 *   TargetShardCount: number,
 * }>
 * ```
 */
KinesisStream.prototype.updateShardCount = async function updateShardCount(count) {
  return this.kinesis.client.updateShardCount({
    ScalingType: 'UNIFORM_SCALING',
    StreamName: this.name,
    TargetShardCount: count,
  }).promise()
}

// () => ()
KinesisStream.prototype.close = function close() {
  this.closed = true
}

KinesisStream.prototype[Symbol.asyncIterator] = async function* asyncIterator() {
  let shards = null,
    records = null
  await this.ready
  do {
    shards = await this.kinesis.client.listShards({
      StreamName: this.name,
      MaxResults: this.listShardsLimit,
      ...shards?.NextToken ? {
        NextToken: shards.NextToken,
      } : {
        ...this.shardFilterType && {
          ShardFilter: {
            Type: this.shardFilterType,
            ...this.shardFilterShardId && {
              ShardId: this.shardFilterShardId,
            },
            ...this.shardFilterTimestamp && {
              Timestamp: this.shardFilterTimestamp,
            },
          },
        },
      },
    }).promise()

    for (const shard of shards.Shards) {
      const startingShardIterator = await this.kinesis.client.getShardIterator({
        ShardId: shard.ShardId,
        StreamName: this.name,
        ShardIteratorType: this.shardIteratorType,
        ...this.shardIteratorTimestamp && {
          Timestamp: this.shardIteratorTimestamp,
        },
      }).promise().then(get('ShardIterator'))
      records = await this.kinesis.client.getRecords({
        ShardIterator: startingShardIterator,
        Limit: this.getRecordsLimit,
      }).promise()

      yield* records.Records
      while (!this.closed && records.NextShardIterator != null) {
        records = await this.kinesis.client.getRecords({
          ShardIterator: records.NextShardIterator,
          Limit: this.getRecordsLimit,
        }).promise()
        if (records.MillisBehindLatest == 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          yield* records.Records
        }
      }
    }
  } while (has('NextToken')(shards))
}

module.exports = KinesisStream
