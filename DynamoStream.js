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
  this.shardIteratorType = options.shardIteratorType ?? 'TRIM_HORIZON'
  this.sequenceNumber = options.sequenceNumber
  this.client = new DynamoDBStreams({
    apiVersion: '2012-08-10',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    region: 'x-x-x',
    ...awsCreds,
  })

  this.dynamo = new Dynamo(awsCreds)
  this.ready = this.dynamo.describeTable(this.table).then(pipe([
    get('Table.StreamSpecification'),
    streamSpec => streamSpec == null ? this.dynamo.enableStreams(this.table, {
      streamViewType: get('streamViewType', 'NEW_AND_OLD_IMAGES')(options)
    }) : {},
  ]))
  return this
}

// () => ()
DynamoStream.prototype.close = function close() {
  this.closed = true
}

DynamoStream.prototype[Symbol.asyncIterator] = async function* asyncGenerator() {
  let headers = null,
    shards = null,
    records = null
  await this.ready
  do {
    headers = await this.client.listStreams({
      TableName: this.table,
      ...headers?.LastEvaluatedStreamArn && {
        ExclusiveStartStreamArn: headers.LastEvaluatedStreamArn,
      },
    }).promise()

    do {
      for (const streamHeader of headers.Streams) {
        shards = await this.client.describeStream({
          StreamArn: streamHeader.StreamArn,
          Limit: 100,
          ...shards?.LastEvaluatedShardId && {
            ExclusiveStartShardId: shards.LastEvaluatedShardId,
          },
        }).promise().then(get('StreamDescription'))

        for (const shard of shards.Shards) {
          const startingShardIterator = await this.client.getShardIterator({
            ShardId: shard.ShardId,
            StreamArn: streamHeader.StreamArn,
            ShardIteratorType: this.shardIteratorType,
            ...this.sequenceNumber && { SequenceNumber: this.sequenceNumber },
          }).promise().then(get('ShardIterator'))
          records = await this.client.getRecords({
            ShardIterator: startingShardIterator,
            Limit: this.getRecordsLimit
          }).promise()

          yield* records.Records
          while (!this.closed && records.NextShardIterator != null) {
            records = await this.client.getRecords({
              ShardIterator: records.NextShardIterator,
              Limit: this.getRecordsLimit
            }).promise()
            if (records.Records.length == 0) {
              await new Promise(resolve => setTimeout(resolve, 1000))
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
