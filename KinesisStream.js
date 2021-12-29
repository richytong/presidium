const Kinesis = require('./Kinesis')
const rubico = require('rubico')
const has = require('rubico/x/has')
const identity = require('rubico/x/identity')
const Mux = require('rubico/monad/Mux')
const differenceWith = require('rubico/x/differenceWith')

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
 *   shardIteratorType: 'AT_SEQUENCE_NUMBER'|'AFTER_SEQUENCE_NUMBER'|'TRIM_HORIZON'|'LATEST'|'AT_TIMESTAMP',
 *   timestamp: Date|string|number, // find events at date (requires shardIteratorType 'AT_TIMESTAMP')
 *   startingSequenceNumber: string, // find events at data record (requires shardIteratorType 'AT_SEQUENCE_NUMBER' or 'AFTER_SEQUENCE_NUMBER')
 *   shardFilterType: 'AFTER_SHARD_ID'|'AT_TRIM_HORIZON'|'FROM_TRIM_HORIZON'|'AT_LATEST'|'AT_TIMESTAMP'|'FROM_TIMESTAMP',
 *   shardFilterShardId: string,
 *   shardFilterTimestamp: Date|string|number,
 *   streamCreationTimestamp: Date|string|number, // distinguishes streams of same name e.g. after deleting
 * }) -> KinesisStream
 * ```
 *
 * @description
 * Creates a Kinesis stream. https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html
 *
 * Sizes, limits, quotas
 * https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html
 */
const KinesisStream = function (options) {
  if (this == null || this.constructor != KinesisStream) {
    return new KinesisStream(options)
  }
  this.name = options.name
  this.listShardsLimit = options.listShardsLimit ?? 1000
  this.getRecordsLimit = options.getRecordsLimit ?? 1000
  this.shardUpdatePeriod = options.shardUpdatePeriod ?? 15000
  this.getRecordsInterval = options.getRecordsInterval ?? 1000
  this.shardIteratorType = options.shardIteratorType ?? 'LATEST'
  this.shardIteratorTimestamp = options.shardIteratorTimestamp
  this.shardFilterType = options.shardFilterType
  this.shardFilterShardId = options.shardFilterShardId
  this.shardFilterTimestamp = options.shardFilterTimestamp
  this.streamCreationTimestamp = options.streamCreationTimestamp
  this.timestamp = options.timestamp
  this.startingSequenceNumber = options.startingSequenceNumber
  this.kinesis = new Kinesis(omit(['name'])(options))
  this.cancelToken = new Promise((_, reject) => (this.canceller = reject))

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

// () => ()
KinesisStream.prototype.close = function close() {
  this.closed = true
  return this
}

// () -> AsyncGenerator<Shard>
KinesisStream.prototype.listShards = async function* listShards() {
  let shards = await this.kinesis.client.listShards({
    StreamName: this.name,
    MaxResults: this.listShardsLimit,
  }).promise()
  yield* shards.Shards
  while (!this.closed && shards.NextToken != null) {
    shards = await this.kinesis.client.listShards({
      StreamName: this.name,
      MaxResults: this.listShardsLimit,
      NextToken: shards.NextToken,
    })
    yield* shards.Shards
  }
}

// Shard -> AsyncGenerator<Record>
KinesisStream.prototype.getRecords = async function* getRecords(Shard) {
  const startingShardIterator = await this.kinesis.client.getShardIterator({
    ShardId: Shard.ShardId,
    StreamName: this.name,
    ShardIteratorType: this.shardIteratorType,
    ...this.shardIteratorTimestamp && {
      Timestamp: this.shardIteratorTimestamp,
    },
  }).promise().then(get('ShardIterator'))

  let records = await this.kinesis.client.getRecords({
    ShardIterator: startingShardIterator,
    Limit: this.getRecordsLimit,
  }).promise()
  if (records.Records.length > 0) {
    yield* records.Records
  }

  while (!this.closed && records.NextShardIterator != null) {
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
    records = await this.kinesis.client.getRecords({
      ShardIterator: records.NextShardIterator,
      Limit: this.getRecordsLimit,
    }).promise()
    if (records.Records.length > 0) {
      yield* records.Records
    }
  }
}

const SymbolUpdateShards = Symbol('UpdateShards')

KinesisStream.prototype[Symbol.asyncIterator] = async function* generateRecords() {
  let shards = await transform(map(identity), [])(this.listShards())
  let muxAsyncIterator = Mux.race([
    ...shards.map(Shard => this.getRecords(Shard)),
    (async function* UpdateShardsGenerator() {
      while (true) {
        await new Promise(resolve => {
          setTimeout(resolve, this.shardUpdatePeriod)
        })
        yield SymbolUpdateShards
      }
    }).call(this),
  ])

  while (!this.closed) {
    const { value, done } = await muxAsyncIterator.next()
    if (value == SymbolUpdateShards) {
      const latestShards = await transform(map(identity), [])(this.listShards())
      const newShards = pipe([
        always(shards),
        differenceWith(
          (ShardA, ShardB) => ShardA.ShardId == ShardB.ShardId,
          latestShards,
        ),
        map(assign({
          ShardIteratorType: always('TRIM_HORIZON'),
        })),
      ])()

      shards = latestShards
      if (newShards.length > 0) {
        muxAsyncIterator = Mux.race([
          ...newShards.map(Shard => this.getRecords(Shard)),
          muxAsyncIterator,
        ])
      }
    } else if (done) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    } else {
      yield value
    }
  }
}

module.exports = KinesisStream
