const DynamoDBStreams = require('aws-sdk/clients/dynamodbstreams')
const rubico = require('rubico')
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
  this.getRecordsInterval = options.getRecordsInterval ?? 5000
  this.shardIteratorType = options.shardIteratorType ?? 'LATEST'
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

// () -> AsyncGenerator<streamHeader>
DynamoStream.prototype.getStreamHeaders = async function* getStreamHeaders() {
  let headers = await this.client.listStreams({
    Limit: this.listStreamsLimit,
    TableName: this.table
  }).promise()
  yield* headers.Streams
  while (!this.closed && headers.LastEvaluatedStreamArn != null) {
    headers = await this.client.listStreams({
      Limit: this.listStreamsLimit,
      TableName: this.table,
      ExclusiveStartStreamArn: headers.LastEvaluatedStreamArn,
    }).promise()
    yield* headers.Streams
  }
}

// () -> AsyncGenerator<Shard>
DynamoStream.prototype.getShards = async function* getShards() {
  yield* flatMap((async function* (streamHeader) {
    let shards = await this.client.describeStream({
      StreamArn: streamHeader.StreamArn,
      Limit: 100,
    }).promise().then(get('StreamDescription'))
    yield* shards.Shards.map(assign({ Stream: always(streamHeader) }))
    while (!this.closed && shards.LastEvaluatedShardId != null) {
      shards = await this.client.describeStream({
        StreamArn: streamHeader.StreamArn,
        Limit: 100,
        ExclusiveStartShardId: shards.LastEvaluatedShardId,
      }).promise().then(get('StreamDescription'))
      yield* shards.Shards.map(assign({ Stream: always(streamHeader) }))
    }
  }).bind(this))(this.getStreamHeaders())
}

// () -> AsyncGenerator<Record>
DynamoStream.prototype.getRecords = async function* getRecords() {
  yield* flatMap((async function* (shard) {
    const startingShardIterator = await this.client.getShardIterator({
      ShardId: shard.ShardId,
      StreamArn: shard.Stream.StreamArn,
      ShardIteratorType: this.shardIteratorType,
      // TODO somehow incorporate sequenceNumber specification for each shard into options
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
      if (records.Records.length == 0) {
        await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
      }
    }
  }).bind(this))(this.getShards())
}

// () => ()
DynamoStream.prototype.close = function close() {
  this.closed = true
}

DynamoStream.prototype[Symbol.asyncIterator] = async function* () {
  while (!this.closed) {
    yield* this.getRecords()
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
  }
}

module.exports = DynamoStream
