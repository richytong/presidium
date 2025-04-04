require('rubico/global')
const Transducer = require('rubico/Transducer')
const DynamoDBStreams = require('aws-sdk/clients/dynamodbstreams')
const rubicox = require('rubico/x')
const has = require('./internal/has')
const RetryAwsErrors = require('./internal/RetryAwsErrors')
const HttpAgent = require('./HttpAgent')
const Dynamo = require('./Dynamo')
const Mux = require('rubico/monad/Mux')

const { identity, differenceWith } = rubicox

/**
 * @name DynamoStream
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoStream(options {
 *   table: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   streamViewType?: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
 *   shardIteratorType?: 'TRIM_HORIZON'|'LATEST'|'AT_SEQUENCE_NUMBER'|'AFTER_SEQUENCE_NUMBER',
 * })
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDBStreams.html
 *
 * DynamoStream -> Stream Headers -> Stream ARNs
 *
 * `eventName` enumeration: `INSERT`, `MODIFY`, `REMOVE`
 */

const DynamoStream = function (options) {
  if (this == null || this.constructor != DynamoStream) {
    return new DynamoStream(options)
  }
  const awsCreds = pick(options, [
    'accessKeyId',
    'secretAccessKey',
    'region',
    'endpoint',
  ])
  this.table = options.table
  this.getRecordsLimit = options.getRecordsLimit ?? 1000
  this.getRecordsInterval = options.getRecordsInterval ?? 1000
  this.shardIteratorType = options.shardIteratorType ?? 'LATEST'
  this.shardUpdatePeriod = options.shardUpdatePeriod ?? 15000
  this.listStreamsLimit = options.listStreamsLimit ?? 100
  this.client = new DynamoDBStreams({
    apiVersion: '2012-08-10',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    region: 'x-x-x',
    ...awsCreds,
  })

  this.retryListStreams = RetryAwsErrors(
    this.client.listStreams,
    this.client,
  )
  this.retryDescribeStream = RetryAwsErrors(
    this.client.describeStream,
    this.client,
  )
  this.retryGetShardIterator = RetryAwsErrors(
    this.client.getShardIterator,
    this.client,
  )
  this.retryGetRecords = RetryAwsErrors(
    this.client.getRecords,
    this.client,
  )

  const dynamo = new Dynamo(awsCreds)
  this.ready = dynamo.describeTable(this.table).then(pipe([
    get('Table.StreamSpecification'),
    streamSpec => streamSpec == null ? dynamo.enableStreams(this.table, {
      streamViewType: get('streamViewType', 'NEW_AND_OLD_IMAGES')(options)
    }) : {},
  ]))

  return this
}

// () => ()
DynamoStream.prototype.close = function close() {
  this.closed = true
}

// () => AsyncGenerator<Stream>
DynamoStream.prototype.getStreams = async function* getStreams() {
  let streams = await this.retryListStreams({
    Limit: this.listStreamsLimit,
    TableName: this.table
  })
  if (streams.Streams.length > 0) {
    yield* streams.Streams
  }
  while (!this.closed && streams.LastEvaluatedStreamArn != null) {
    streams = await this.retryListStreams({
      Limit: this.listStreamsLimit,
      TableName: this.table,
      ExclusiveStartStreamArn: streams.LastEvaluatedStreamArn,
    })
    if (streams.Streams.length > 0) {
      yield* streams.Streams
    }
  }
}

// Stream => AsyncGenerator<Shard>
DynamoStream.prototype.getShards = async function* getShards(
  Stream,
) {
  let shards = await this.retryDescribeStream({
    StreamArn: Stream.StreamArn,
    Limit: 100,
  }).then(get('StreamDescription'))
  if (shards.Shards.length > 0) {
    yield* shards.Shards.map(assign({ Stream: always(Stream) }))
  }
  while (!this.closed && shards.LastEvaluatedShardId != null) {
    shards = await this.retryDescribeStream({
      StreamArn: Stream.StreamArn,
      Limit: 100,
      ExclusiveStartShardId: shards.LastEvaluatedShardId,
    }).then(get('StreamDescription'))
    if (shards.Shards.length > 0) {
      yield* shards.Shards.map(assign({ Stream: always(Stream) }))
    }
  }
}

// handleGetRecordsError(error Error) -> ()
const handleGetRecordsError = error => {
  if (error.message.includes('Shard iterator has expired')) {
    return []
  }
  throw error
}
DynamoStream.handleGetRecordsError = handleGetRecordsError

// Shard => AsyncGenerator<Record>
DynamoStream.prototype.getRecords = async function* getRecords(
  Shard,
) {
  const startingShardIterator = await this.retryGetShardIterator({
    ShardId: Shard.ShardId,
    StreamArn: Shard.Stream.StreamArn,
    ShardIteratorType: Shard.ShardIteratorType,

    /*
    ...(
      Shard.ShardIteratorType == 'AFTER_SEQUENCE_NUMBER'
      || Shard.ShardIteratorType == 'AT_SEQUENCE_NUMBER'
    ) ? { SequenceNumber: Shard.SequenceNumber } : {},
    */

  }).then(get('ShardIterator'))

  let records = await this.retryGetRecords({
    ShardIterator: startingShardIterator,
    Limit: this.getRecordsLimit
  }).catch(handleGetRecordsError)

  if (records.Records.length > 0) {
    yield* records.Records.map(assign({
      table: always(this.table),
      shardId: always(Shard.ShardId),
    }))
  }
  await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))

  while (!this.closed && records.NextShardIterator != null) {
    records = await this.retryGetRecords({
      ShardIterator: records.NextShardIterator,
      Limit: this.getRecordsLimit
    }).catch(handleGetRecordsError)
    if (records.Records.length > 0) {
      yield* records.Records.map(assign({
        table: always(this.table),
        shardId: always(Shard.ShardId),
      }))
    }
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
  }
}

const SymbolUpdateShards = Symbol('UpdateShards')

DynamoStream.prototype[Symbol.asyncIterator] = async function* () {
  let shards = await pipe(this.getStreams(), [
    flatMap(Stream => this.getShards(Stream)),
    map(assign({
      ShardIteratorType: always(this.shardIteratorType),
    })),
    transform(Transducer.passthrough, []),
  ])
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
      const latestShards = await pipe(this.getStreams(), [
        flatMap(Stream => this.getShards(Stream)),
        transform(Transducer.passthrough, []),
      ])
      const newShards = pipe(shards, [
        differenceWith(
          (ShardA, ShardB) => ShardA.ShardId == ShardB.ShardId,
          latestShards,
        ),
        map(assign({
          ShardIteratorType: always('TRIM_HORIZON'),
        })),
      ])

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

module.exports = DynamoStream
