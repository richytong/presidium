const DynamoDBStreams = require('aws-sdk/clients/dynamodbstreams')
const rubico = require('rubico')
const rubicox = require('rubico/x')
const has = require('./internal/has')
const HttpAgent = require('./HttpAgent')
const Dynamo = require('./Dynamo')
const Mux = require('rubico/monad/Mux')

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

const {
  identity,
  differenceWith,
} = rubicox

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
 */

const DynamoStream = function (options) {
  if (this == null || this.constructor != DynamoStream) {
    return new DynamoStream(options)
  }
  const awsCreds = pick([
    'accessKeyId',
    'secretAccessKey',
    'region',
    'endpoint',
  ])(options)
  this.table = options.table
  this.getRecordsLimit = options.getRecordsLimit ?? 1000
  this.getRecordsInterval = options.getRecordsInterval ?? 1000
  this.shardIteratorType = options.shardIteratorType ?? 'LATEST'
  this.shardUpdatePeriod = options.shardUpdatePeriod ?? 30000
  this.listStreamsLimit = options.listStreamsLimit ?? 100
  this.debug = options.debug ?? false
  this.client = new DynamoDBStreams({
    apiVersion: '2012-08-10',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    region: 'x-x-x',
    ...awsCreds,
  })

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
  let streams = await this.client.listStreams({
    Limit: this.listStreamsLimit,
    TableName: this.table
  }).promise()
  yield* streams.Streams
  while (!this.closed && streams.LastEvaluatedStreamArn != null) {
    streams = await this.client.listStreams({
      Limit: this.listStreamsLimit,
      TableName: this.table,
      ExclusiveStartStreamArn: streams.LastEvaluatedStreamArn,
    }).promise()
    yield* streams.Streams
  }
}

// Stream => AsyncGenerator<Shard>
DynamoStream.prototype.getShards = async function* getShards(
  Stream,
) {
  let shards = await this.client.describeStream({
    StreamArn: Stream.StreamArn,
    Limit: 100,
  }).promise().then(get('StreamDescription'))
  yield* shards.Shards.map(
    (Shard, ShardNumber) => ({ ...Shard, Stream, ShardNumber }))
  while (!this.closed && shards.LastEvaluatedShardId != null) {
    shards = await this.client.describeStream({
      StreamArn: Stream.StreamArn,
      Limit: 100,
      ExclusiveStartShardId: shards.LastEvaluatedShardId,
    }).promise().then(get('StreamDescription'))
    yield* shards.Shards.map(
      (Shard, ShardNumber) => ({ ...Shard, Stream, ShardNumber }))
  }
}

// Shard => AsyncGenerator<Record>
DynamoStream.prototype.getRecords = async function* getRecords(
  Shard,
) {
  const startingShardIterator = await this.client.getShardIterator({
    ShardId: Shard.ShardId,
    StreamArn: Shard.Stream.StreamArn,
    ShardIteratorType: Shard.ShardIteratorType,

    /*
    ...(
      Shard.ShardIteratorType == 'AFTER_SEQUENCE_NUMBER'
      || Shard.ShardIteratorType == 'AT_SEQUENCE_NUMBER'
    ) ? { SequenceNumber: Shard.SequenceNumber } : {},
    */

  }).promise().then(get('ShardIterator'))
  let records = await this.client.getRecords({
    ShardIterator: startingShardIterator,
    Limit: this.getRecordsLimit
  }).promise()

  yield* records.Records
  while (!this.closed && records.NextShardIterator != null) {
    records = await this.client.getRecords({
      ShardIterator: records.NextShardIterator,
      Limit: this.getRecordsLimit
    }).promise()
    yield* records.Records
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
  }
}

const SymbolUpdateShards = Symbol('UpdateShards')

DynamoStream.prototype[Symbol.asyncIterator] = async function* () {
  let shards = await pipe([
    always(this.getStreams()),
    flatMap(Stream => this.getShards(Stream)),
    map(assign({
      ShardIteratorType: always(this.shardIteratorType),
    })),
    transform(map(identity), []),
  ])()
  let muxAsyncIterator = Mux.race(shards.map(Shard => this.getRecords(Shard)))
  let iterationPromise = muxAsyncIterator.next()
  let shardUpdatePromise = new Promise(resolve => setTimeout(
    thunkify(resolve, SymbolUpdateShards), this.shardUpdatePeriod))

  while (!this.closed) {
    const iteration = await Promise.race([
      shardUpdatePromise,
      iterationPromise,
    ])
    if (iteration == SymbolUpdateShards) {
      const latestShards = await pipe([
        always(this.getStreams()),
        flatMap(Stream => this.getShards(Stream)),
        transform(map(identity), []),
      ])()
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

      if (this.debug) {
        console.log('Latest shards:', latestShards)
      }

      shards = latestShards
      muxAsyncIterator = newShards.length == 0 ? muxAsyncIterator : Mux.race([
        ...newShards.map(Shard => this.getRecords(Shard)),
        muxAsyncIterator,
      ])
      shardUpdatePromise = new Promise(resolve => setTimeout(
        thunkify(resolve, SymbolUpdateShards), this.shardUpdatePeriod))
    } else if (iteration.done) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      iterationPromise = muxAsyncIterator.next()
    } else {
      yield iteration.value
      iterationPromise = muxAsyncIterator.next()
    }
  }
}

module.exports = DynamoStream
