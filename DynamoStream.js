const DynamoDBStreams = require('aws-sdk/clients/dynamodbstreams')
const rubico = require('rubico')
const has = require('./internal/has')
const HttpAgent = require('./HttpAgent')
const Dynamo = require('./Dynamo')

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
 *   viewType?: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
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
  this.shardIteratorType = get('shardIteratorType', 'TRIM_HORIZON')(options)
  this.sequenceNumber = get('sequenceNumber', null)(options)
  this.dynamodbstreams = new DynamoDBStreams({
    apiVersion: '2012-08-10',
    accessKeyId: 'accessKeyId-placeholder',
    secretAccessKey: 'secretAccessKey-placeholder',
    region: 'region-placeholder',
    httpOptions: { agent: HttpAgent() },
    ...awsCreds,
  })

  this.dynamo = new Dynamo(awsCreds)
  this.ready = this.dynamo.describeTable(this.table).then(pipe([
    get('Table.StreamSpecification'),
    streamSpec => streamSpec == null ? this.dynamo.enableStreams(this.table, {
      viewType: get('viewType', 'NEW_AND_OLD_IMAGES')(options)
    }) : {},
  ]))
  return this
}

/**
 * @name DynamoStream.prototype.getHeaders
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoStream(options).getHeaders(opts? {
 *   exclusiveStartStreamArn: string,
 * }) -> Promise<{
 *   Streams: Array<{
 *     StreamArn: string,
 *     StreamLabel: <date>,
 *     TableName: string,
 *   }>,
 *   LastEvaluatedStreamArn?: string,
 * }>
 * ```
 */
DynamoStream.prototype.getHeaders = async function getHeaders(options = {}) {
  await this.ready
  return this.dynamodbstreams.listStreams({
    TableName: this.table,
    ...options.exclusiveStartStreamArn && {
      ExclusiveStartStreamArn: options.exclusiveStartStreamArn,
    },
  }).promise()
}

/**
 * @name DynamoStream.prototype.getShardsFromHeader
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoStream(options).getShardsFromHeader(streamHeader {
 *   StreamArn: string,
 * }, options? {
 *   limit: number,
 *   exclusiveStartShardId: string,
 * }) -> Promise<{
 *   Shards: Array<{
 *     ShardId: string,
 *     ParentShardId: string,
 *     SequenceNumberRange: {
 *       StartingSequenceNumber: string,
 *       EndingSequenceNumber: string,
 *     },
 *     StreamArn: string,
 *   }>,
 *   LastEvaluatedShardId?: string,
 * }>
 * ```
 */
DynamoStream.prototype.getShardsFromHeader = async function (streamHeader, options = {}) {
  await this.ready
  return this.dynamodbstreams.describeStream({
    StreamArn: streamHeader.StreamArn,
    Limit: get('limit', 100)(options),
    ...options.exclusiveStartShardId && {
      ExclusiveStartShardId: options.exclusiveStartShardId,
    },
  }).promise().then(fork({
    Shards: pipe([
      get('StreamDescription.Shards'),
      map(assign({
        StreamArn: always(streamHeader.StreamArn),
      })),
    ]),
    LastEvaluatedShardId: get('StreamDescription.LastEvaluatedShardId'),
  }))
}

/**
 * @name DynamoStream.prototype.getShardIterator
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoStream(options).getShardIterator(streamShard {
 *   ShardId: string,
 *   StreamArn: string,
 * }) -> Promise<string>
 * ```
 */
DynamoStream.prototype.getShardIterator = async function getShardIterator(streamShard) {
  await this.ready
  return this.dynamodbstreams.getShardIterator({
    ShardId: streamShard.ShardId,
    ShardIteratorType: this.shardIteratorType,
    StreamArn: streamShard.StreamArn,
  }).promise().then(get('ShardIterator'))
}

/**
 * @name DynamoStream.prototype.getRecords
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoStream(options).getRecords(
 *   shardIterator string,
 *   opts {
 *     limit: 1000|number,
 *   },
 * ) -> Promise<{
 *   Records: {
 *     eventID: string,
 *     eventName: 'INSERT'|'MODIFY'|'REMOVE',
 *     eventVersion: string,
 *     eventSource: 'aws:dynamodb',
 *     awsRegion: string,
 *     dynamodb: Array<{
 *       Keys: Object,
 *       NewImage: Object,
 *       OldImage: Object,
 *       SequenceNumber: string,
 *       SizeBytes: number,
 *       StreamViewType: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
 *     }>,
 *   },
 *   NextShardIterator?: string,
 * }>
 * ```
 */
DynamoStream.prototype.getRecords = function getRecords(shardIterator, options = {}) {
  return this.dynamodbstreams.getRecords({
    ShardIterator: shardIterator,
    Limit: get('limit', 1000)(options),
  }).promise()
}

DynamoStream.prototype[Symbol.asyncIterator] = async function* asyncGenerator() {
  let headers = null,
    shards = null,
    records = null
  await this.ready
  do {
    headers = await this.getHeaders({
      exclusiveStartStreamArn: get('LastEvaluatedStreamArn')(headers),
    })
    do {
      for (const streamHeader of headers.Streams) {
        shards = await this.getShardsFromHeader(streamHeader, {
          exclusiveStartShardId: get('LastEvaluatedShardId')(shards),
        })

        for (const shard of shards.Shards) {
          const startingShardIterator = await this.getShardIterator(shard)
          records = await this.getRecords(startingShardIterator) // TODO coverage here
          yield* records.Records
          while (records.NextShardIterator != null) {
            records = await this.getRecords(records.NextShardIterator)
            if (records.Records.length == 0) {
              break
            } else {
              yield* records.Records
            }
          }
        }
      }
    } while (shards?.LastEvaluatedShardId != null)
  } while (headers?.LastEvaluatedStreamArn != null)
}

module.exports = DynamoStream
