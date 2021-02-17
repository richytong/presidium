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
  this.debug = options.debug
  this.table = options.table
  this.getRecordsLimit = options.getRecordsLimit ?? 1000
  this.getRecordsInterval = options.getRecordsInterval ?? 1000
  this.shardIteratorType = options.shardIteratorType ?? 'LATEST'
  this.shardUpdatePeriod = options.shardUpdatePeriod ?? 1000
  this.listStreamsLimit = options.listStreamsLimit ?? 100
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
  if (this.debug) {
    console.log(`DynamoStream: got ${streams.Streams.length} stream(s)`)
  }
  yield* streams.Streams
  while (!this.closed && streams.LastEvaluatedStreamArn != null) {
    streams = await this.client.listStreams({
      Limit: this.listStreamsLimit,
      TableName: this.table,
      ExclusiveStartStreamArn: streams.LastEvaluatedStreamArn,
    }).promise()
    if (this.debug) {
      console.log(`DynamoStream: got ${streams.Streams.length} stream(s)`)
    }
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
  if (this.debug) {
    console.log(`DynamoStream: got ${shards.Shards.length} shards(s)`)
  }
  yield* shards.Shards.map(assign({ Stream: always(Stream) }))
  while (!this.closed && shards.LastEvaluatedShardId != null) {
    shards = await this.client.describeStream({
      StreamArn: Stream.StreamArn,
      Limit: 100,
      ExclusiveStartShardId: shards.LastEvaluatedShardId,
    }).promise().then(get('StreamDescription'))
    if (this.debug) {
      console.log(`DynamoStream: got ${shards.Shards.length} shards(s)`)
    }
    yield* shards.Shards.map(assign({ Stream: always(Stream) }))
  }
}

// Shard => AsyncGenerator<Record>
DynamoStream.prototype.getRecords = async function* getRecords(
  Shard,
) {
  const startingShardIterator = await this.client.getShardIterator({
    ShardId: Shard.ShardId,
    StreamArn: Shard.Stream.StreamArn,
    ShardIteratorType: this.shardIteratorType,
    // TODO somehow incorporate sequenceNumber specification for each shard into options
  }).promise().then(get('ShardIterator'))
  let records = await this.client.getRecords({
    ShardIterator: startingShardIterator,
    Limit: this.getRecordsLimit
  }).promise()
  if (this.debug) {
    console.log(`DynamoStream: got ${records.Records.length} records(s)`)
  }

  yield* records.Records
  while (!this.closed && !Shard.closed && records.NextShardIterator != null) {
    records = await this.client.getRecords({
      ShardIterator: records.NextShardIterator,
      Limit: this.getRecordsLimit
    }).promise()
    if (this.debug) {
      console.log(`DynamoStream: got ${records.Records.length} records(s)`)
    }
    yield* records.Records
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
  }
}

const SymbolUpdateShards = Symbol('UpdateShards')

DynamoStream.prototype[Symbol.asyncIterator] = async function* () {
  let shards = await pipe([
    transform(map(identity), []),
    flatMap(Stream => this.getShards(Stream)),
  ])(this.getStreams())
  let muxAsyncIterator = Mux.race(shards.map(Shard => this.getRecords(Shard)))
  let iterationPromise = muxAsyncIterator.next()
  let shardUpdatePromise = new Promise(resolve => setTimeout(
    thunkify(resolve, SymbolUpdateShards), this.shardUpdatePeriod))

  while (!this.closed) {
    const iteration = await Promise.race([
      iterationPromise,
      shardUpdatePromise,
    ])
    if (iteration == SymbolUpdateShards) {
      const latestShards = await pipe([
        transform(map(identity), []),
        flatMap(Stream => this.getShards(Stream)),
      ])(this.getStreams())
      const newShards = differenceWith(
        (ShardA, ShardB) => ShardA.ShardId == ShardB.ShardId,
        latestShards)(shards)
      const closedShards = differenceWith(
        (ShardA, ShardB) => ShardA.ShardId == ShardB.ShardId,
        shards)(latestShards)
      if (this.debug) {
        console.log(
          'DynamoStream: updated shards',
          JSON.stringify(map(pick(['ShardId']))({
            newShards, closedShards, latestShards,
          })))
      }

      closedShards.forEach(Shard => (Shard.closed = true))
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
