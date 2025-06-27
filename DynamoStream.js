require('rubico/global')
const Transducer = require('rubico/Transducer')
const DynamoDBStreams = require('./aws-sdk/clients/dynamodbstreams')
const { differenceWith } = require('rubico/x')
const has = require('./internal/has')
const RetryAwsErrors = require('./internal/RetryAwsErrors')
const HttpAgent = require('./HttpAgent')
const Dynamo = require('./Dynamo')
const Mux = require('rubico/monad/Mux')

/**
 * @name DynamoStream
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DynamoStream(options {
 *   table: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   streamViewType?: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
 *   shardIteratorType?: 'TRIM_HORIZON'|'LATEST'|'AT_SEQUENCE_NUMBER'|'AFTER_SEQUENCE_NUMBER',
 * }) -> DynamoStream
 * ```
 */
class DynamoStream {
  constructor(options) {
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

      async streamSpec => {
        if (streamSpec == null) {
          const enableStreamsResponse = await dynamo.enableStreams(this.table, {
            streamViewType: options.streamViewType ?? 'NEW_AND_OLD_IMAGES',
          })
          return { message: 'enabling-streams', enableStreamsResponse }
        }
        return { message: 'streams-enabled' }
      },
    ]))
  }

  /**
   * @name close
   *
   * @synopsis
   * ```coffeescript [specscript]
   * close() -> ()
   * ```
   */
  close() {
    this.closed = true
  }

  /**
   * @name getStreams
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getStreams() -> AsyncIterator<Stream { StreamArn: string }>
   * ```
   */
  async * getStreams() {
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

  /**
   * @name getShards
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getShards(Stream { StreamArn: string }) -> AsyncIterator<Shard {
   *   ShardId: string,
   *   ShardIteratorType: string,
   *   Stream: { StreamArn: string },
   * }>
   * ```
   */
  async * getShards(Stream) {
    let shards = await this.retryDescribeStream({
      StreamArn: Stream.StreamArn,
      Limit: 100,
    }).then(get('StreamDescription'))
    if (shards.Shards.length > 0) {
      yield* shards.Shards.map(assign({ Stream }))
    }
    while (!this.closed && shards.LastEvaluatedShardId != null) {
      shards = await this.retryDescribeStream({
        StreamArn: Stream.StreamArn,
        Limit: 100,
        ExclusiveStartShardId: shards.LastEvaluatedShardId,
      }).then(get('StreamDescription'))
      if (shards.Shards.length > 0) {
        yield* shards.Shards.map(assign({ Stream }))
      }
    }
  }

  // handleGetRecordsError(error Error) -> ()
  static handleGetRecordsError(error) {
    if (error.message.includes('Shard iterator has expired')) {
      console.error(error)
      return []
    }
    throw error
  }


  /**
   * @name getRecords
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * getRecords(Shard {
   *   ShardId: string,
   *   ShardIteratorType: string,
   *   Stream: { StreamArn: string },
   * }) -> AsyncIterator<Record {
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
  async * getRecords(Shard) {
    const startingShardIterator = await this.retryGetShardIterator({
      ShardId: Shard.ShardId,
      StreamArn: Shard.Stream.StreamArn,
      ShardIteratorType: Shard.ShardIteratorType,
    }).then(get('ShardIterator'))

    let getRecordsResponse = await this.retryGetRecords({
      ShardIterator: startingShardIterator,
      Limit: this.getRecordsLimit
    }).catch(DynamoStream.handleGetRecordsError)

    if (getRecordsResponse.Records == null) {
      const error =
        new Error('DynamoStream: getRecordsResponse.Records undefined')
      error.getRecordsResponse = getRecordsResponse
      throw error
    }
    else if (getRecordsResponse.Records.length > 0) {
      yield* getRecordsResponse.Records.map(assign({
        table: this.table,
        shardId: Shard.ShardId,
      }))
    }
    await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))

    while (!this.closed && getRecordsResponse.NextShardIterator != null) {
      getRecordsResponse = await this.retryGetRecords({
        ShardIterator: getRecordsResponse.NextShardIterator,
        Limit: this.getRecordsLimit
      }).catch(DynamoStream.handleGetRecordsError)
      if (getRecordsResponse.Records == null) {
        const error =
          new Error('DynamoStream: getRecordsResponse.Records undefined')
        error.getRecordsResponse = getRecordsResponse
        throw error
      } else if (getRecordsResponse.Records.length > 0) {
        yield* getRecordsResponse.Records.map(assign({
          table: this.table,
          shardId: Shard.ShardId,
        }))
      }
      await new Promise(resolve => setTimeout(resolve, this.getRecordsInterval))
    }
  }

  SymbolUpdateShards = Symbol('UpdateShards')

  /**
   * @name [Symbol.asyncIterator]
   *
   * @synopsis
   * ```coffeescript [specscript]
   * [Symbol.asyncIterator]() -> AsyncIterator<Record {
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
   *
   * @description
   * Implements the [async iterable protocol](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols#the_async_iterator_and_async_iterable_protocols). Allows for consumption of the DynamoDB stream as an async iterable.
   *
   * ```
   * const awsCreds = {
   *   accessKeyId: 'my-access-key-id',
   *   secretAccessKey: 'my-secret-access-key',
   *   region: 'my-region',
   * }
   *
   * const myTable = new DynamoTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * cons myStream = new DynamoStream({
   *   table: 'my-table',
   *   ...awsCreds,
   * })
   * await myStream.ready
   *
   * for await (const record of myStream) {
   *   console.log(record)
   *   // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *   // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *   // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   * }
   * ```
   *
   * Same DynamoStream instance [Symbol.asyncIterator] interface may be invoked to produce multiple streams of the same records
   *
   * ```javascript
   * ;(async () => {
   *   for await (const record of myStream) {
   *     console.log(record)
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *   }
   * })()
   *
   * // records from above and below invokations are duplicated and streamed in parallel
   *
   * ;(async () => {
   *   for await (const record of myStream) {
   *     console.log(record)
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *     // { eventID: '...', eventName: '...', dynamodb: {...}, ... }
   *   }
   * })()
   * ```
   */
  async * [Symbol.asyncIterator]() {
    let shards = await pipe(this.getStreams(), [
      flatMap(Stream => this.getShards(Stream)),
      map(assign({ ShardIteratorType: this.shardIteratorType })),
      transform(Transducer.passthrough, []),
    ])

    let muxAsyncIterator = Mux.race([
      ...shards.map(Shard => this.getRecords(Shard)),
      (async function* UpdateShardsGenerator() {
        while (true) {
          await new Promise(resolve => {
            setTimeout(resolve, this.shardUpdatePeriod)
          })
          yield this.SymbolUpdateShards
        }
      }).call(this),
    ])

    while (!this.closed) {
      const { value, done } = await muxAsyncIterator.next()
      if (value == this.SymbolUpdateShards) {
        const latestShards = await pipe(this.getStreams(), [
          flatMap(Stream => this.getShards(Stream)),
          transform(Transducer.passthrough, []),
        ])
        const newShards = pipe(shards, [
          differenceWith(
            (ShardA, ShardB) => ShardA.ShardId == ShardB.ShardId,
            latestShards,
          ),
          map(assign({ ShardIteratorType: 'TRIM_HORIZON' })),
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
}

module.exports = DynamoStream
