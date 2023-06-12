require('rubico/global')
const Transducer = require('rubico/Transducer')
const Kinesis = require('./Kinesis')
const has = require('rubico/x/has')
const identity = require('rubico/x/identity')
const Mux = require('rubico/monad/Mux')
const differenceWith = require('rubico/x/differenceWith')

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
  this.shardCount = options.shardCount ?? 1
  this.timestamp = options.timestamp
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
      ShardCount: this.shardCount,
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
 *   data string|Buffer,
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

/**
 * @name KinesisStream.prototype.putRecords
 *
 * @synopsis
 * ```coffeescript [specscript]
 * KinesisStream(options).putRecords(records Array<{
 *   data: string|Buffer,
 *   partitionKey: string, // input to aws hash function to determine which shard
 *   explicitHashKey: string, // skips aws hash function to determine which shard
 * }>) -> Promise<{
 *   FailedRecordCount: number, // number of unsuccessfully processed records
 *   Records: Array<{
 *     SequenceNumber: string,
 *     ShardId: string,
 *     ErrorCode?: 'ProvisionedThroughputExceededException'|'InternalFailure',
 *     ErrorMessage?: string,
 *   }>,
 *   EncryptionType: 'NONE'|'KMS',
 * }>
 * ```
 *
 * @description
 * Limits/Quotas:
 *  * 500 records max per request
 *  * 1 MB per record max
 *  * 5 MB per request max
 *  * 1000 records per second per shard
 *  * 1 MB per second per shard
 *
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/Kinesis.html#putRecords-property
 */
KinesisStream.prototype.putRecords = async function putRecords(records) {
  return this.kinesis.client.putRecords({
    StreamName: this.name,
    Records: records.map(({ data, partitionKey, explicitHashKey }) => ({
      Data: data,
      PartitionKey: partitionKey ?? data.slice(0, 255),
      ...explicitHashKey && { ExplicitHashKey: explicitHashKey },
    }))
  }).promise().then(tap(response => {
    if (response.Records.some(has('ErrorCode'))) {
      const errors = response.Records.filter(has('ErrorCode')).map(Record => {
        const error = new Error(Record.ErrorMessage)
        error.code = Record.ErrorCode
        return error
      })
      throw new AggregateError(errors, 'Some records failed to process')
    }
  }))
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
  if (shards.Shards.length > 0) {
    yield* shards.Shards
  }

  while (!this.closed && shards.NextToken != null) {
    shards = await this.kinesis.client.listShards({
      StreamName: this.name,
      MaxResults: this.listShardsLimit,
      NextToken: shards.NextToken,
    })
    if (shards.Shards.length > 0) {
      yield* shards.Shards
    }
  }
}

// Shard -> AsyncGenerator<Record>
KinesisStream.prototype.getRecords = async function* getRecords(Shard) {
  const startingShardIterator = await this.kinesis.client.getShardIterator({
    ShardId: Shard.ShardId,
    StreamName: this.name,
    ShardIteratorType: this.shardIteratorType,
    ...this.timestamp == null ? {} : { Timestamp: this.timestamp },
  }).promise().then(get('ShardIterator'))

  let records = await this.kinesis.client.getRecords({
    ShardIterator: startingShardIterator,
    Limit: this.getRecordsLimit,
  }).promise()
  if (records.Records.length > 0) {
    yield* records.Records
  }
  await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))

  while (!this.closed && records.NextShardIterator != null) {
    records = await this.kinesis.client.getRecords({
      ShardIterator: records.NextShardIterator,
      Limit: this.getRecordsLimit,
    }).promise()
    if (records.Records.length > 0) {
      yield* records.Records
    }
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
  }
}

const SymbolUpdateShards = Symbol('UpdateShards')

KinesisStream.prototype[Symbol.asyncIterator] = async function* generateRecords() {
  let shards = await transform(this.listShards(), Transducer.passthrough, [])
  let muxAsyncIterator = Mux.race([
    ...shards.map(Shard => this.getRecords(Shard)),
    (async function* UpdateShardsGenerator() {
      while (!this.closed) {
        await new Promise(resolve => {
          setTimeout(resolve, this.shardUpdatePeriod)
        })
        if (!this.closed) {
          yield SymbolUpdateShards
        }
      }
    }).call(this),
  ])

  while (!this.closed) {
    const { value, done } = await muxAsyncIterator.next()
    if (value == SymbolUpdateShards) {
      const latestShards =
        await transform(this.listShards(), Transducer.passthrough, [])
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
