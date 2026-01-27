require('rubico/global')
const crypto = require('crypto')
const HTTP = require('./HTTP')
const userAgent = require('./userAgent')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AmzDate = require('./internal/AmzDate')
const Readable = require('./Readable')
const DynamoDBIndexname = require('./internal/DynamoDBIndexname')
const DynamoDBKeySchema = require('./internal/DynamoDBKeySchema')
const DynamoDBAttributeDefinitions =
  require('./internal/DynamoDBAttributeDefinitions')
const DynamoDBAttributeType =
  require('./internal/DynamoDBAttributeType')
const DynamoDBAttributeValue =
  require('./internal/DynamoDBAttributeValue')
const DynamoDBAttributeValueJSON =
  require('./internal/DynamoDBAttributeValueJSON')
const hashJSON = require('./internal/hashJSON')
const sleep = require('./internal/sleep')
const createExpressionAttributeNames =
  require('./internal/createExpressionAttributeNames')
const createExpressionAttributeValues =
  require('./internal/createExpressionAttributeValues')
const createKeyConditionExpression =
  require('./internal/createKeyConditionExpression')
const createFilterExpression = require('./internal/createFilterExpression')

/**
 * @name DynamoDBGlobalSecondaryIndex
 *
 * @docs
 * ```coffeescript [specscript]
 * new DynamoDBGlobalSecondaryIndex(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   table: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> globalSecondaryIndex DynamoDBGlobalSecondaryIndex
 * ```
 *
 * The presidium DynamoDBGlobalSecondaryIndex client. Creates the DynamoDB Global Secondary Index (GSI) if it doesn't exist.
 *
 * DynamoDBGlobalSecondaryIndex instances have a `ready` promise that resolves when the GSI is active.
 *
 * ```javascript
 * const awsCreds = {
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region',
 * }
 *
 * const myProductionTable = new DynamoTable({
 *   name: 'my-production-table',
 *   key: [{ id: 'string' }],
 *   ...awsCreds,
 * })
 * await myProductionTable.ready
 *
 * const myProductionStatusUpdateTimeIndex = new DynamoDBGlobalSecondaryIndex({
 *   table: 'my-production-table',
 *   key: [{ status: 'string' }, { updateTime: 'number' }],
 *   ...awsCreds,
 * })
 * await myProductionStatusUpdateTimeIndex.ready
 * ```
 *
 * @note
 * [AWS DynamoDB Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)
 */
class DynamoDBGlobalSecondaryIndex {

  constructor(options) {
    this.table = options.table
    this.key = options.key
    this.name = DynamoDBIndexname(this.key)

    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2012-08-10'

    if (options.endpoint) {
      const endpointUrl = new URL(options.endpoint)
      this.endpoint = endpointUrl.host
      this.protocol = endpointUrl.protocol.replace(/:$/, '')
    } else {
      this.endpoint = `dynamodb.${this.region}.amazonaws.com`
      this.protocol = 'http'
    }

    this.BillingMode = options.BillingMode ?? 'PAY_PER_REQUEST'
    if (this.BillingMode == 'PROVISIONED') {
      this.ProvisionedThroughput = options.ProvisionedThroughput ?? {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }

    this.http = new HTTP(`${this.protocol}://${this.endpoint}`)

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
   * _readyPromise() -> ready Promise<>
   * ```
   */
  async _readyPromise() {
    try {
      await this.describe()
      await this.waitForActive()
      return { message: 'global-secondary-index-exists' }
    } catch (error) {
      await this.create()
      await this.waitForActive()
      return { message: 'created-global-secondary-index' }
    }
  }

  /**
   * @name _awsRequest
   *
   * @docs
   * ```coffeescript [specscript]
   * module http 'https://nodejs.org/api/http.html'
   *
   * _awsRequest(
   *   method string,
   *   url string,
   *   action string,
   *   payload string
   * ) -> response Promise<http.ServerResponse>
   * ```
   */
  _awsRequest(method, url, action, payload) {
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
   * @name describeTable
   *
   * @docs
   * ```coffeescript [specscript]
   * describeTable() -> data Promise<>
   * ```
   */
  async describeTable() {
    const payload = JSON.stringify({
      TableName: this.table,
    })
    const response =
      await this._awsRequest('POST', '/', 'DescribeTable', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name describe
   *
   * @docs
   * ```coffeescript [specscript]
   * describe() -> indexData Promise<{
   *   IndexArn: string,
   *   IndexName: string,
   *   IndexStatus: string,
   *   KeySchema: [
   *     { AttributeName: string, KeyType: 'HASH' },
   *     { AttributeName: string, KeyType: 'RANGE' },
   *   ]
   *   BillingModeSummary: {
   *     BillingMode: 'PAY_PER_REQUEST'|'PROVISIONED',
   *   },
   *   ProvisionedThroughput: {
   *     ReadCapacityUnits: number,
   *     WriteCapacityUnits: number,
   *   },
   * }>
   * ```
   */
  async describe() {
    const payload = JSON.stringify({
      TableName: this.table,
    })
    const response =
      await this._awsRequest('POST', '/', 'DescribeTable', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      const indexData =
        data.Table.GlobalSecondaryIndexes?.find(eq(this.name, get('IndexName')))

      if (indexData == null) {
        throw new Error(`DynamoDB Global Secondary Index ${this.name} not found`)
      }
      indexData.BillingModeSummary = data.Table.BillingModeSummary
      return indexData
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name create
   *
   * @docs
   * ```coffeescript [specscript]
   * create() -> indexData Promise<{
   *   IndexArn: string,
   *   IndexName: string,
   *   IndexStatus: string,
   *   KeySchema: [
   *     { AttributeName: string, KeyType: 'HASH' },
   *     { AttributeName: string, KeyType: 'RANGE' },
   *   ]
   *   BillingModeSummary: {
   *     BillingMode: 'PAY_PER_REQUEST'|'PROVISIONED',
   *   },
   *   ProvisionedThroughput: {
   *     ReadCapacityUnits: number,
   *     WriteCapacityUnits: number,
   *   },
   * }>
   * ```
   */
  async create() {
    const tableData = await this.describeTable()

    let createIndexParams = {
      IndexName: this.name,
      KeySchema: DynamoDBKeySchema(this.key),
      Projection: {
        ProjectionType: 'ALL',
      },
    }
    if (tableData.Table.BillingModeSummary.BillingMode == 'PROVISIONED') {
      createIndexParams.ProvisionedThroughput = this.ProvisionedThroughput
    }

    const payload = JSON.stringify({
      TableName: this.table,
      AttributeDefinitions: DynamoDBAttributeDefinitions(this.key),
      GlobalSecondaryIndexUpdates: [{ Create: createIndexParams }],
    })

    const response =
      await this._awsRequest('POST', '/', 'UpdateTable', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      const indexData =
        data
        .TableDescription
        .GlobalSecondaryIndexes
        ?.find(eq(this.name, get('IndexName')))

      return indexData
    }

    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name waitForActive
   *
   * @docs
   * ```coffeescript [specscript]
   * waitForActive() -> empty Promise<>
   * ```
   */
  async waitForActive() {
    let indexData = await this.describe()
    while (indexData.IndexStatus != 'ACTIVE') {
      await sleep(100)
      indexData = await this.describe()
    }
  }

  /**
   * @name waitForNotExists
   *
   * @docs
   * ```coffeescript [specscript]
   * waitForNotExists() -> empty Promise<>
   * ```
   */
  async waitForNotExists() {
    let exists = true
    while (exists) {
      await sleep(100)
      await this.describe().catch(error => {
        if (error.message == `DynamoDB Global Secondary Index ${this.name} not found`) {
          exists = false
        } else {
          throw error
        }
      })
    }
  }

  /**
   * @name query
   *
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * query(
   *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
   *   Values DynamoDBJSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   },
   * ) -> data Promise<{ Items: Array<DynamoDBJSONObject> }>
   * ```
   *
   * Query a DynamoDB Global Secondary Index using DynamoDB JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey status and sortKey time
   *
   * const pendingItemsLast24h = await myIndex.query(
   *   'status = :status AND time > :time',
   *   {
   *     status: 'pending',
   *     time: Date.now() - (24 * 60 * 60 * 1000),
   *   },
   *   { ScanIndexForward: true },
   * )
   * console.log(pendingItemsLast24h)
   * // [
   * //   { id: { S: 'a' }, status: { S: 'pending' }, time: { N: 1749565352158 } },
   * //   { id: { S: 'b' }, status: { S: 'pending' }, time: { N: 1749565352159 } },
   * //   { id: { S: 'c' }, status: { S: 'pending' }, time: { N: 1749565352160 } },
   * //   ...
   * // ]
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *   * `ExclusiveStartKey` - DynamoDB JSON Key after which to start reading.
   *   * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   */
  async query(keyConditionExpression, Values, options = {}) {
    const values = map(Values, DynamoDBAttributeValueJSON)

    const keyConditionStatements = keyConditionExpression.trim().split(/\s+AND\s+/)
    let statementsIndex = -1
    while (++statementsIndex < keyConditionStatements.length) {
      if (keyConditionStatements[statementsIndex].includes('BETWEEN')) {
        keyConditionStatements[statementsIndex] +=
          ` AND ${keyConditionStatements.splice(statementsIndex + 1, 1)}`
      }
    }

    const filterExpressionStatements =
      options.FilterExpression == null ? []
      : options.FilterExpression.trim().split(/\s+AND\s+/)
    statementsIndex = -1
    while (++statementsIndex < filterExpressionStatements.length) {
      if (filterExpressionStatements[statementsIndex].includes('BETWEEN')) {
        filterExpressionStatements[statementsIndex] +=
          ` AND ${filterExpressionStatements.splice(statementsIndex + 1, 1)}`
      }
    }

    const ExpressionAttributeNames = createExpressionAttributeNames({
      keyConditionStatements,
      filterExpressionStatements,
      ...options,
    })

    const ExpressionAttributeValues = createExpressionAttributeValues({ values })

    const KeyConditionExpression = createKeyConditionExpression({
      keyConditionStatements,
    })

    const FilterExpression = createFilterExpression({
      filterExpressionStatements,
    })

    const payload = JSON.stringify({
      TableName: this.table,
      IndexName: this.name,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      KeyConditionExpression,

      ScanIndexForward: options.ScanIndexForward ?? true,

      ...filterExpressionStatements.length > 0 ? { FilterExpression } : {},

      ...options.Limit ? { Limit: options.Limit } : {},

      ...options.ExclusiveStartKey
        ? { ExclusiveStartKey: options.ExclusiveStartKey }
        : {},

      ...options.ProjectionExpression ? {
        ProjectionExpression: options.ProjectionExpression
          .split(',').map(field => `#${hashJSON(field)}`).join(','),
      } : {},
    })
    const response = await this._awsRequest('POST', '/', 'Query', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name queryJSON
   *
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * queryJSON(
   *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
   *   values JSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   },
   * ) -> Promise<{ ItemsJSON: Array<JSONObject> }>
   * ```
   *
   * Query a DynamoDB Global Secondary Index using JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey status and sortKey time
   *
   * const pendingItemsJSONLast24h = await myIndex.queryJSON(
   *   'status = :status AND time > :time',
   *   {
   *     status: 'pending',
   *     time: Date.now() - (24 * 60 * 60 * 1000),
   *   },
   *   { ScanIndexForward: true },
   * )
   * console.log(pendingItemsJSONLast24h)
   * // [
   * //   { id: 'a', status: 'pending', time: 1749565352158 },
   * //   { id: 'b', status: 'pending', time: 1749565352159 },
   * //   { id: 'c', status: 'pending', time: 1749565352160 },
   * //   ...
   * // ]
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *   * `ExclusiveStartKey` - DynamoDB JSON Key after which to start reading.
   *   * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   */
  async queryJSON(keyConditionExpression, values, options = {}) {
    const keyConditionStatements = keyConditionExpression.trim().split(/\s+AND\s+/)
    let statementsIndex = -1
    while (++statementsIndex < keyConditionStatements.length) {
      if (keyConditionStatements[statementsIndex].includes('BETWEEN')) {
        keyConditionStatements[statementsIndex] +=
          ` AND ${keyConditionStatements.splice(statementsIndex + 1, 1)}`
      }
    }

    const filterExpressionStatements =
      options.FilterExpression == null ? []
      : options.FilterExpression.trim().split(/\s+AND\s+/)
    statementsIndex = -1
    while (++statementsIndex < filterExpressionStatements.length) {
      if (filterExpressionStatements[statementsIndex].includes('BETWEEN')) {
        filterExpressionStatements[statementsIndex] +=
          ` AND ${filterExpressionStatements.splice(statementsIndex + 1, 1)}`
      }
    }

    const ExpressionAttributeNames = createExpressionAttributeNames({
      keyConditionStatements,
      filterExpressionStatements,
      ...options,
    })

    const ExpressionAttributeValues = createExpressionAttributeValues({ values })

    const KeyConditionExpression = createKeyConditionExpression({
      keyConditionStatements,
    })

    const FilterExpression = createFilterExpression({
      filterExpressionStatements,
    })

    const payload = JSON.stringify({
      TableName: this.table,
      IndexName: this.name,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      KeyConditionExpression,

      ScanIndexForward: options.ScanIndexForward ?? true,

      ...filterExpressionStatements.length > 0 ? { FilterExpression } : {},

      ...options.Limit ? { Limit: options.Limit } : {},

      ...options.ExclusiveStartKey
        ? { ExclusiveStartKey: options.ExclusiveStartKey }
        : {},

      ...options.ProjectionExpression ? {
        ProjectionExpression: options.ProjectionExpression
          .split(',').map(field => `#${hashJSON(field)}`).join(','),
      } : {},
    })
    const response = await this._awsRequest('POST', '/', 'Query', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      data.ItemsJSON = map(data.Items, map(DynamoDBAttributeValueJSON))
      delete data.Items
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name queryItemsIterator
   *
   * @docs
   * ```coffeescript [specscript]
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * index.queryItemsIterator(
   *   keyConditionExpression string,
   *   queryValues JSONObject,
   *   options {
   *     BatchLimit: number,
   *     Limit: number,
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   }
   * ) -> AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Global Secondary Index (GSI) in DynamoDB JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey type and sortKey time
   *
   * const iter = myIndex.queryItemsIterator(
   *   'type = :type AND time > :time',
   *   { type: 'page_view', time: 0 },
   * )
   *
   * for await (const item of iter) {
   *   console.log(item)
   *   // { type: { S: 'page_view' }, time: { N: 1749565352158 } }
   *   // { type: { S: 'page_view' }, time: { N: 1749565352159 } }
   *   // { type: { S: 'page_view' }, time: { N: 1749565352160 } }
   *   // ...
   * }
   * ```
   *
   * Options:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call.
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *   * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   */
  async * queryItemsIterator(keyConditionExpression, Values, options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    const Limit = options.Limit ?? Infinity
    const ScanIndexForward = options.ScanIndexForward ?? true

    let numYielded = 0
    let response = await this.query(
      keyConditionExpression,
      Values,
      {
        ScanIndexForward,
        Limit: Math.min(BatchLimit, Limit - numYielded),
        ...pick(options, ['ProjectionExpression', 'FilterExpression']),
      },
    )
    yield* response.Items
    numYielded += response.Items.length

    while (response.LastEvaluatedKey != null && numYielded < Limit) {
      response = await this.query(
        keyConditionExpression,
        Values,
        {
          ScanIndexForward,
          Limit: Math.min(BatchLimit, Limit - numYielded),
          ExclusiveStartKey: response.LastEvaluatedKey,
          ...pick(options, ['ProjectionExpression', 'FilterExpression']),
        },
      )
      yield* response.Items
      numYielded += response.Items.length
    }
  }

  /**
   * @name queryItemsIteratorJSON
   *
   * @docs
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * queryItemsIteratorJSON(
   *   keyConditionExpression string,
   *   values JSONObject,
   *   options {
   *     BatchLimit: number,
   *     Limit: number,
   *     ScanIndexForward: boolean // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   }
   * ) -> AsyncIterator<JSONObject>
   * ```
   *
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Table in JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey <!-- < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey type and sortKey time
   *
   * const iter = myIndex.queryItemsIterator(
   *   'type = :type AND time > :time',
   *   { type: 'page_view', time: 0 },
   * )
   *
   * for await (const item of iter) {
   *   console.log(item)
   *   // { type: 'page_view', time: 1749565352158 }
   *   // { type: 'page_view', time: 1749565352159 }
   *   // { type: 'page_view', time: 1749565352160 }
   *   // ...
   * }
   * ```
   *
   * Options:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call.
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *   * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   */
  async * queryItemsIteratorJSON(keyConditionExpression, values, options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    const Limit = options.Limit ?? Infinity
    const ScanIndexForward = options.ScanIndexForward ?? true

    let numYielded = 0
    let response = await this.queryJSON(
      keyConditionExpression,
      values,
      {
        ScanIndexForward,
        Limit: Math.min(BatchLimit, Limit - numYielded),
        ...pick(options, ['ProjectionExpression', 'FilterExpression']),
      },
    )
    yield* response.ItemsJSON
    numYielded += response.ItemsJSON.length

    while (response.LastEvaluatedKey != null && numYielded < Limit) {
      response = await this.queryJSON(
        keyConditionExpression,
        values,
        {
          ScanIndexForward,
          Limit: Math.min(BatchLimit, Limit - numYielded),
          ExclusiveStartKey: response.LastEvaluatedKey,
          ...pick(options, ['ProjectionExpression', 'FilterExpression']),
        },
      )
      yield* response.ItemsJSON
      numYielded += response.ItemsJSON.length
    }
  }

}

module.exports = DynamoDBGlobalSecondaryIndex
