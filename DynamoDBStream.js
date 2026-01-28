require('rubico/global')
const { differenceWith } = require('rubico/x')
const Transducer = require('rubico/Transducer')
const Mux = require('rubico/monad/Mux')
const crypto = require('crypto')
const HTTP = require('./HTTP')
const userAgent = require('./userAgent')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AmzDate = require('./internal/AmzDate')
const Readable = require('./Readable')
const sleep = require('./internal/sleep')
const dynamoDBStreamGetStreamsIterator =
  require('./internal/dynamoDBStreamGetStreamsIterator')
const dynamoDBStreamGetShardsIterator =
  require('./internal/dynamoDBStreamGetShardsIterator')
const dynamoDBStreamGetRecordsIterator =
  require('./internal/dynamoDBStreamGetRecordsIterator')

const SymbolUpdateShards = Symbol('UpdateShards')

/**
 * @name DynamoDBStream
 *
 * @docs
 * ```coffeescript [specscript]
 * new DynamoDBStream(options {
 *   table: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 *   StreamViewType: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
 *   ShardIteratorType: 'TRIM_HORIZON'|'LATEST',
 *   GetRecordsLimit: number,
 *   GetRecordsInterval: number,
 *   ShardUpdatePeriod: number,
 *   ListStreamsLimit: number,
 * }) -> stream DynamoDBStream
 * ```
 */
class DynamoDBStream {
  constructor(options) {
    this.table = options.table

    this.StreamViewType = options.StreamViewType ?? 'NEW_AND_OLD_IMAGES'
    this.ShardIteratorType = options.ShardIteratorType ?? 'LATEST'
    this.GetRecordsLimit = options.GetRecordsLimit ?? 1000
    this.GetShardsInterval = options.GetShardsInterval ?? 1000
    this.GetRecordsInterval = options.GetRecordsInterval ?? 1000
    this.ShardUpdatePeriod = options.ShardUpdatePeriod ?? 15000
    this.ListStreamsLimit = options.ListStreamsLimit ?? 100
    this.JSON = options.JSON ?? false

    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2012-08-10'

    this.endpoint = `dynamodb.${this.region}.amazonaws.com`
    this.streamsEndpoint = `streams.dynamodb.${this.region}.amazonaws.com`
    this.protocol = 'https'

    this.http = new HTTP(`${this.protocol}://${this.endpoint}`)
    this.streamsHttp = new HTTP(`${this.protocol}://${this.streamsEndpoint}`)

    this.autoReady = options.autoReady ?? true
    if (this.autoReady) {
      this.ready = this._readyPromise()
    }
  }

  /**
   * @name _readyPromise
   *
   * @docs
   * ```coffeescript [specscript]
   * _readyPromise() -> Promise<>
   * ```
   */
  async _readyPromise() {
    try {
      await this.describe()
      await this.waitForActive()
      return { message: 'stream-exists' }
    } catch (error) {
      await this.create()
      await this.waitForActive()
      return { message: 'created-stream' }
    }
  }

  /**
   * @name _awsDynamoDBRequest
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * _awsDynamoDBRequest(
   *   method string,
   *   url string,
   *   action string,
   *   payload string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsDynamoDBRequest(method, url, action, payload) {
    const amzDate = AmzDate()
    const amzTarget = `DynamoDB_${this.apiVersion.replace(/-/g, '')}.${action}`

    const headers = {
      'Host': this.endpoint,
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
      'User-Agent': userAgent,
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': amzTarget
    }

    const amzHeaders = {}
    for (const key in headers) {
      if (key.toLowerCase().startsWith('x-amz')) {
        amzHeaders[key] = headers[key]
      }
    }

    headers['Authorization'] = AwsAuthorization({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      method,
      endpoint: this.endpoint,
      protocol: this.protocol,
      canonicalUri: url,
      serviceName: 'dynamodb',
      payloadHash:
        crypto.createHash('sha256').update(payload, 'utf8').digest('hex'),
      expires: 300,
      queryParams: new URLSearchParams(),
      headers: {
        'Host': this.endpoint,
        ...amzHeaders
      }
    })

    return this.http[method](url, { headers, body: payload })
  }

  /**
   * @name _awsDynamoDBStreamsRequest
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * _awsDynamoDBStreamsRequest(
   *   method string,
   *   url string,
   *   action string,
   *   payload string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsDynamoDBStreamsRequest(method, url, action, payload) {
    const amzDate = AmzDate()
    const amzTarget = `DynamoDBStreams_${this.apiVersion.replace(/-/g, '')}.${action}`

    const headers = {
      'Host': this.streamsEndpoint,
      'Accept-Encoding': 'identity',
      'Content-Length': Buffer.byteLength(payload, 'utf8'),
      'User-Agent': userAgent,
      'Content-Type': 'application/x-amz-json-1.0',
      'X-Amz-Date': amzDate,
      'X-Amz-Target': amzTarget
    }

    const amzHeaders = {}
    for (const key in headers) {
      if (key.toLowerCase().startsWith('x-amz')) {
        amzHeaders[key] = headers[key]
      }
    }

    headers['Authorization'] = AwsAuthorization({
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      region: this.region,
      method,
      endpoint: this.streamsEndpoint,
      protocol: this.protocol,
      canonicalUri: url,
      serviceName: 'dynamodb',
      payloadHash:
        crypto.createHash('sha256').update(payload, 'utf8').digest('hex'),
      expires: 300,
      queryParams: new URLSearchParams(),
      headers: {
        'Host': this.streamsEndpoint,
        ...amzHeaders
      }
    })

    return this.streamsHttp[method](url, { headers, body: payload })
  }

  /**
   * @name describe
   *
   * @docs
   * ```coffeescript [specscript]
   * describe() -> streamData Promise<{
   *   StreamEnabled: boolean,
   *   StreamViewType: 'NEW_AND_OLD_IMAGES'|'NEW_IMAGE'|'OLD_IMAGE'|'KEYS_ONLY',
   *   TableStatus: 'CREATING'|'UPDATING'|'DELETING'|'ACTIVE'|'INACCESSIBLE_ENCRYPTION_CREDENTIALS'|'ARCHIVING'|'ARCHIVED'
   * }>
   * ```
   */
  async describe() {
    const payload = JSON.stringify({
      TableName: this.table,
    })
    const response =
      await this._awsDynamoDBRequest('POST', '/', 'DescribeTable', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      const streamData = data.Table.StreamSpecification
      if (streamData == null) {
        throw new Error(`DynamoDB Stream for ${this.table} not found.`)
      }
      streamData.TableStatus = data.Table.TableStatus
      return streamData
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name create
   *
   * @docs
   * ```coffeescript [specscript]
   * create() -> data Promise<{}>
   * ```
   */
  async create() {
    const payload = JSON.stringify({
      TableName: this.table,
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: this.StreamViewType,
      },
    })

    const response =
      await this._awsDynamoDBRequest('POST', '/', 'UpdateTable', payload)

    if (response.ok) {
      await Readable.Text(response)
      return {}
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name waitForActive
   *
   * @docs
   * ```coffeescript [specscript]
   * waitForActive() -> Promise<>
   * ```
   */
  async waitForActive() {
    let exists = false
    while (!exists) {
      await sleep(100)
      const streamData = await this.describe().catch(error => {
        if (error.message == `DynamoDB Stream for ${this.table} not found.`) {
          // return
        } else {
          throw error
        }
      })
      if (streamData.TableStatus == 'ACTIVE') {
        exists = true
      }
    }
  }

  /**
   * @name describeStream
   *
   * @docs
   * ```coffeescript [specscript]
   * describeStream(options {
   *   StreamArn: string,
   *   Limit: number,
   * }) -> streamData Promise<{
   *   StreamDescription: {
   *     KeySchema: [
   *       { AttributeName: string, KeyType: string },
   *       { AttributeName: string, KeyType: string },
   *     ],
   *     LastEvaluatedShardId: string,
   *     Shards: Array<{
   *       ParentShardId: string,
   *       SequenceNumberRange: {
   *         EndingSequenceNumber: string,
   *         StartingSequenceNumber: string,
   *       },
   *       ShardId: string,
   *     }>,
   *     StreamArn: string,
   *     StreamLabel: string, # ISO 8601 Date string
   *     StreamStatus: string,
   *     StreamViewType: string,
   *     TableName: string,
   *   },
   * }>
   * ```
   */
  async describeStream(options) {
    const payload = JSON.stringify({
      StreamArn: options.StreamArn,
      Limit: options.Limit
    })

    const response = await this._awsDynamoDBStreamsRequest(
      'POST',
      '/',
      'DescribeStream',
      payload,
    )

    if (response.ok) {
      const data = await Readable.JSON(response)
      return data
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> ()
   * ```
   */
  close() {
    this.closed = true
  }

  /**
   * @name [Symbol.asyncIterator]
   *
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * stream[Symbol.asyncIterator]() -> asyncIterator AsyncIterator<Record {
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
   * cons myStream = new DynamoDBStream({
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
   * Same DynamoDBStream instance [Symbol.asyncIterator] interface may be invoked to produce multiple streams of the same records
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
    let shards = await pipe(dynamoDBStreamGetStreamsIterator.call(this), [
      flatMap(Stream => dynamoDBStreamGetShardsIterator.call(this, {
        StreamArn: Stream.StreamArn,
      })),
      transform(Transducer.passthrough, []),
    ])

    let muxAsyncIterator = Mux.race([
      ...shards.map(Shard => dynamoDBStreamGetRecordsIterator.call(this, {
        ShardId: Shard.ShardId,
        StreamArn: Shard.StreamArn,
      })),
      (async function* UpdateShardsGenerator() {
        while (true) {
          await sleep(this.ShardUpdatePeriod)
          yield SymbolUpdateShards
        }
      }).call(this),
    ])

    while (!this.closed) {
      const { value, done } = await muxAsyncIterator.next()
      if (value == SymbolUpdateShards) {
        const latestShards = await pipe(dynamoDBStreamGetStreamsIterator.call(this), [
          flatMap(Stream => dynamoDBStreamGetShardsIterator.call(this, {
            StreamArn: Stream.StreamArn,
          })),
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
            ...newShards.map(Shard => dynamoDBStreamGetRecordsIterator.call(this, {
              ShardId: Shard.ShardId,
              StreamArn: Shard.StreamArn,
            })),
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

module.exports = DynamoDBStream
