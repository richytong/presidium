require('rubico/global')
const { identity } = require('rubico/x')
require('aws-sdk/lib/maintenance_mode_message').suppress = true
const crypto = require('crypto')
const Dynamo = require('./internal/Dynamo')
const HTTP = require('./HTTP')
const userAgent = require('./userAgent')
const AwsAuthorization = require('./internal/AwsAuthorization')
const AmzDate = require('./internal/AmzDate')
const Readable = require('./Readable')
const DynamoDBKeySchema = require('./internal/DynamoDBKeySchema')
const DynamoDBAttributeDefinitions =
  require('./internal/DynamoDBAttributeDefinitions')
const DynamoDBAttributeType =
  require('./internal/DynamoDBAttributeType')
const DynamoDBAttributeValue =
  require('./internal/DynamoDBAttributeValue')
const DynamoDBAttributeValueJSON =
  require('./internal/DynamoDBAttributeValueJSON')
const AwsError = require('./internal/AwsError')
const hashJSON = require('./internal/hashJSON')
const sleep = require('./internal/sleep')
const join = require('./internal/join')
const createExpressionAttributeNames =
  require('./internal/createExpressionAttributeNames')
const createExpressionAttributeValues =
  require('./internal/createExpressionAttributeValues')
const createKeyConditionExpression =
  require('./internal/createKeyConditionExpression')
const createFilterExpression = require('./internal/createFilterExpression')

/**
 * @name DynamoDBTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DynamoDBTable(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> table DynamoDBTable
 * ```
 *
 * @description
 * The presidium DynamoDBTable client. Creates the DynamoDB Table if it doesn't exist.
 *
 * DynamoDBTable instances have a `ready` promise that resolves when the table is active.
 *
 * ```javascript
 * // local testing
 * const myLocalTable = new DynamoDBTable({
 *   name: 'my-local-table',
 *   key: [{ id: 'string' }],
 *   endpoint: 'http://localhost:8000/',
 * })
 * await myLocalTable.ready
 *
 * // production
 * const myProductionTable = new DynamoDBTable({
 *   name: 'my-production-table',
 *   key: [{ id: 'string' }],
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region',
 * })
 * await myProductionTable.ready
 * ```
 *
 * @note
 * [AWS DynamoDB Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)
 */
class DynamoDBTable {
  constructor(options) {
    this.name = options.name
    this.key = options.key

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
      return { message: 'table-exists' }
    } catch (error) {
      await this.create()
      await this.waitForActive()
      return { message: 'created-table' }
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
   * @name describe
   *
   * @synopsis
   * ```coffeescript [specscript]
   * describe() -> data Promise<>
   * ```
   */
  async describe() {
    const payload = JSON.stringify({
      TableName: this.name
    })
    const response =
      await this._awsRequest('POST', '/', 'DescribeTable', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name create
   *
   * @docs
   * ```coffeescript [specscript]
   * create() -> data Promise<>
   * ```
   */
  async create() {
    let payload = {
      TableName: this.name,
      KeySchema: DynamoDBKeySchema(this.key),
      AttributeDefinitions: DynamoDBAttributeDefinitions(this.key),
      BillingMode: this.BillingMode,
    }
    if (payload.BillingMode == 'PROVISIONED') {
      payload.ProvisionedThroughput = this.ProvisionedThroughput
    }
    payload = JSON.stringify(payload)

    const response = await this._awsRequest('POST', '/', 'CreateTable', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name waitForActive
   *
   * @docs
   * ```coffeescript [specscript]
   * waitForActive() -> data Promise<>
   * ```
   */
  async waitForActive() {
    const payload = JSON.stringify({
      TableName: this.name
    })
    let response = await this._awsRequest('POST', '/', 'DescribeTable', payload)

    if (response.ok) {
      let data = await Readable.JSON(response)
      while (data.Table.TableStatus != 'ACTIVE') {
        await sleep(100)
        response = await this._awsRequest('POST', '/', 'DescribeTable', payload)
        if (response.ok) {
          data = await Readable.JSON(response)
        } else {
          throw new AwsError(await Readable.Text(response), response.status)
        }
      }
      return undefined
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name waitForNotExists
   *
   * @docs
   * ```coffeescript [specscript]
   * waitForNotExists() -> data Promise<>
   * ```
   */
  async waitForNotExists() {
    const payload = JSON.stringify({
      TableName: this.name
    })

    let response = await this._awsRequest('POST', '/', 'DescribeTable', payload)
    let responseText = await Readable.Text(response)

    while (!responseText.includes('ResourceNotFoundException')) {
      await sleep(100)
      response = await this._awsRequest('POST', '/', 'DescribeTable', payload)
      responseText = await Readable.Text(response)
    }

    return undefined
  }

  /**
   * @name closeConnections
   *
   * @docs
   * ```coffeescript [specscript]
   * closeConnections() -> ()
   * ```
   */
  closeConnections() {
    this.http.closeConnections()
  }

  /**
   * @name delete
   *
   * @synopsis
   * ```coffeescript [specscript]
   * delete() -> data Promise<>
   * ```
   *
   * @description
   * Delete the DynamoDB Table.
   *
   * ```javascript
   * await myTable.delete()
   * ```
   */
  async delete() {
    const payload = JSON.stringify({
      TableName: this.name
    })
    const response = await this._awsRequest('POST', '/', 'DeleteTable', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * putItem(item DynamoDBJSONObject, options {
   *   ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *   ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *   ReturnValues: 'NONE'|'ALL_OLD',
   * }) -> data Promise<{
   *   Attributes: {...},
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string
   *   }
   * }>
   * ```
   *
   * @description
   * Write an item to a DynamoDB Table using DyanmoDB JSON.
   *
   * ```javascript
   * await userTable.putItem({
   *   id: { S: '1' },
   *   name: { S: 'John' },
   *   age: { N: 32 },
   * })
   * ```
   *
   * @note
   * [AWS DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
   */
  async putItem(Item, options = {}) {
    const payload = JSON.stringify({
      TableName: this.name,
      Item,
      ...options
    })
    const response = await this._awsRequest('POST', '/', 'PutItem', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name putItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * putItemJSON(item JSONObject, options {
   *   ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *   ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *   ReturnValues: 'NONE'|'ALL_OLD',
   * }) -> data Promise<{
   *   AttributesJSON: JSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * @description
   * Write an item to a DynamoDB Table using JSON format.
   *
   * ```javascript
   * await userTable.putItemJSON({
   *   id: '1',
   *   name: 'John',
   *   age: 32
   * })
   * ```
   *
   * @note
   * [AWS DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
   */
  async putItemJSON(item, options = {}) {
    const payload = JSON.stringify({
      TableName: this.name,
      Item: map(item, DynamoDBAttributeValue),
      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'PutItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      if (data.Attributes) {
        data.AttributesJSON = map(data.Attributes, DynamoDBAttributeValueJSON)
        delete data.Attributes
      }

      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name getItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * getItem(key DynamoDBJSONKey) ->
   *   data Promise<{ Item: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Retrieve an item from a DynamoDB Table using DynamoDB JSON format.
   *
   * ```javascript
   * const res = await userTable.getItem({ id: { S: '1' } })
   * console.log(res) // { Item: { id: { S: '1' }, name: { S: 'John' } } }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  async getItem(Key) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key
    })
    const response = await this._awsRequest('POST', '/', 'GetItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      if (data.Item == null) {
        throw new Error(`Item not found for ${JSON.stringify(Key)}`)
      }

      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name getItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|Buffer,
   *   [sortKey string]: string|number|Buffer
   * }
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * getItemJSON(key JSONKey) -> data Promise<{ ItemJSON: JSONObject }>
   * ```
   *
   * @description
   * Retrieve an item from a DynamoDB Table using JSON format.
   *
   * ```javascript
   * const user = await userTable.getItemJSON({ id: '1' })
   * console.log(user) // { id: '1', name: 'John' }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  async getItemJSON(key) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key: map(key, DynamoDBAttributeValue)
    })
    const response = await this._awsRequest('POST', '/', 'GetItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)
      if (data.Item == null) {
        throw new Error(`Item not found for ${JSON.stringify(key)}`)
      }

      data.ItemJSON = map(data.Item, DynamoDBAttributeValueJSON)
      delete data.Item
      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name updateItem
   *
   * @synopsis
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
   * updateItem(
   *   Key DynamoDBJSONKey,
   *   Updates DynamoDBJSONObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Update an item in a DynamoDB Table using DynamoDB JSON format.
   *
   * ```javascript
   * await userTable.updateItem({ id: { S: '1' } }, {
   *   name: { S: 'James' },
   *   height: { N: 180 },
   *   heightUnits: { S: 'cm' },
   * })
   * ```
   *
   * @note
   * [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
   */
  async updateItem(Key, Updates, options = {}) {
    const updates = map(Updates, DynamoDBAttributeValueJSON)

    const payload = JSON.stringify({
      TableName: this.name,
      Key,

      UpdateExpression: pipe(updates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
        join(', '),
        expression => `set ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(updates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(updates, ([key, value]) => [
          `:${hashJSON(value)}`,
          DynamoDBAttributeValue(value),
        ]),

      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'UpdateItem', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name updateItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|Buffer,
   *   [sortKey string]: string|number|Buffer
   * }
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * updateItemJSON(
   *   key JSONKey,
   *   updates JSONObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ AttributesJSON: JSONObject }>
   * ```
   *
   * @description
   * Update an item in a DynamoDB Table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.updateItemJSON({ id: '1' }, {
   *   name: 'Name',
   *   height: 180,
   *   heightUnits: 'cm',
   * })
   * ```
   *
   * @note
   * [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
   */
  async updateItemJSON(key, updates, options = {}) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key: map(key, DynamoDBAttributeValue),

      UpdateExpression: pipe(updates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
        join(', '),
        expression => `set ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(updates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(updates, ([key, value]) => [
          `:${hashJSON(value)}`,
          DynamoDBAttributeValue(value),
        ]),

      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'UpdateItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      if (data.Attributes) {
        data.AttributesJSON = map(data.Attributes, DynamoDBAttributeValueJSON)
        delete data.Attributes
      }

      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name incrementItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONIncrementObject = Object<{ N: number }>
   *
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * incrementItem(
   *   key DynamoDBJSONKey,
   *   incrementUpdates DynamoDBJSONIncrementObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Increment the attributes of an item in a DynamoDB Table. Negative numbers will decrement the attribute of the item. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.incrementItem({ id: { S: '1' } }, { age: { N: 1 } })
   * ```
   */
  async incrementItem(Key, IncrementUpdates, options = {}) {
    const incrementUpdates = map(IncrementUpdates, DynamoDBAttributeValueJSON)

    const payload = JSON.stringify({
      TableName: this.name,
      Key,

      UpdateExpression: pipe(incrementUpdates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} :${hashJSON(value)}`),
        join(', '),
        expression => `add ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(incrementUpdates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(incrementUpdates, ([key, value]) => [
          `:${hashJSON(value)}`,
          DynamoDBAttributeValue(value),
        ]),

      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'UpdateItem', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name incrementItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|Buffer,
   *   [sortKey string]: string|number|Buffer
   * }
   *
   * type JSONIncrementObject = Object<number>
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * incrementItemJSON(
   *   key JSONKey,
   *   incrementUpdates JSONIncrementObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ AttributesJSON: JSONObject }>
   * ```
   *
   * @description
   * Increment the attributes of an item in a DynamoDB Table. Negative numbers will decrement the attribute of the item. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.incrementItemJSON({ id: '1' }, { age: 1 })
   * ```
   */
  async incrementItemJSON(key, incrementUpdates, options = {}) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key: map(key, DynamoDBAttributeValue),

      UpdateExpression: pipe(incrementUpdates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} :${hashJSON(value)}`),
        join(', '),
        expression => `add ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(incrementUpdates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(incrementUpdates, ([key, value]) => [
          `:${hashJSON(value)}`,
          DynamoDBAttributeValue(value),
        ]),

      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'UpdateItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      if (data.Attributes) {
        data.AttributesJSON = map(data.Attributes, DynamoDBAttributeValueJSON)
        delete data.Attributes
      }

      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name deleteItem
   *
   * @synopsis
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
   * deleteItem(
   *   key DynamoDBJSONKey,
   *   options {
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD',
   *   }
   * ) -> data Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Delete an item from a DynamoDB Table using DynamoDB JSON.
   *
   * ```javascript
   * await userTable.deleteItem({ id: { S: '1' } })
   * ```
   */
  async deleteItem(Key, options) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key,
      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'DeleteItem', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name deleteItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|Buffer,
   *   [sortKey string]: string|number|Buffer,
   * }
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * deleteItemJSON(
   *   key JSONKey,
   *   options {
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD',
   *   }
   * ) -> data Promise<{ AttributesJSON: JSONObject }>
   * ```
   *
   * @description
   * Delete an item from a DynamoDB Table using JSON format.
   *
   * ```javascript
   * await userTable.deleteItemJSON({ id: '1' })
   * ```
   */
  async deleteItemJSON(key, options) {
    const payload = JSON.stringify({
      TableName: this.name,
      Key: map(key, DynamoDBAttributeValue),
      ...options,
    })
    const response = await this._awsRequest('POST', '/', 'DeleteItem', payload)

    if (response.ok) {
      const data = await Readable.JSON(response)

      if (data.Attributes) {
        data.AttributesJSON = map(data.Attributes, DynamoDBAttributeValueJSON)
        delete data.Attributes
      }

      return data
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name scan
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * scan(options {
   *   Limit: number,
   *   ExclusiveStartKey: DynamoDBJSONKey
   * }) -> data Promise<{
   *   Items: Array<DynamoDBJSONObject>>
   *   Count: number,
   *   ScannedCount: number,
   *   LastEvaluatedKey: DynamoDBJSONKey
   * }>
   * ```
   *
   * @description
   * Get an unordered, paginated list of items from a DynamoDB Table.
   *
   * ```javascript
   * const scanResponse = await userTable.scan()
   * console.log(userItems) // [{ id: { S: '1' }, name: { S: 'John' } }, ...]
   * ```
   */
  async scan(options = {}) {
    const payload = JSON.stringify({
      TableName: this.name,
      Limit: options.Limit ?? 1000,
      ...options.ExclusiveStartKey
        ? { ExclusiveStartKey: options.ExclusiveStartKey }
        : {},
    })
    const response = await this._awsRequest('POST', '/', 'Scan', payload)

    if (response.ok) {
      return Readable.JSON(response)
    }
    throw new AwsError(await Readable.Text(response), response.status)
  }

  /**
   * @name scanItemsIterator
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * scanItemsIterator(options {
   *   BatchLimit: number,
   * }) -> iter AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * @description
   * Get an async iterator of all items from a DynamoDB Table.
   */
  async * scanItemsIterator(options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    let response = await this.scan({ Limit: BatchLimit })
    yield* response.Items
    while (response.LastEvaluatedKey != null) {
      response = await this.scan({
        Limit: BatchLimit,
        ExclusiveStartKey: response.LastEvaluatedKey,
      })
      yield* response.Items
    }
  }

  /**
   * @name scanItemsIteratorJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * scanItemsIteratorJSON(options {
   *   BatchLimit: number,
   * }) -> iter AsyncIterator<JSONObject>
   * ```
   *
   * @description
   * Get an async iterator of all items from a DynamoDB Table in JSON format.
   */
  async * scanItemsIteratorJSON(options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    let response = await this.scan({ Limit: BatchLimit })
    yield* map(response.Items, map(DynamoDBAttributeValueJSON))
    while (response.LastEvaluatedKey != null) {
      response = await this.scan({
        Limit: BatchLimit,
        ExclusiveStartKey: response.LastEvaluatedKey,
      })
      yield* map(response.Items, map(DynamoDBAttributeValueJSON))
    }
  }

  /**
   * @name query
   *
   * @synopsis
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
   *     ConsistentRead: boolean // true to perform a strongly consistent read (eventually consistent by default)
   *   },
   * ) -> data Promise<{ Items: Array<DynamoDBJSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB Table using DynamoDB JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const data = await userVersionTable.query(
   *   'id = :id AND version > :version',
   *   { id: { S: '1' }, version: { N: '0' } },
   *   { ScanIndexForward: false },
   * )
   *
   * console.log(data)
   * // {
   * //   Items: [
   * //     { id: { S: '1' }, version: { N: '3' } },
   * //     { id: { S: '1' }, version: { N: '2' } },
   * //     // ...
   * //   ]
   * // }
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   *   * `ConsistentRead` - true to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
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
      TableName: this.name,
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

      ...options.ConsistentRead ? { ConsistentRead: options.ConsistentRead } : {}
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
   * @synopsis
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
   *     ConsistentRead: boolean // true to perform a strongly consistent read (eventually consistent by default)
   *   },
   * ) -> Promise<{ ItemsJSON: Array<JSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB Table using JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const data = await userVersionTable.queryJSON(
   *   'id = :id AND version > :version',
   *   { id: '1', version: 0 },
   *   { ScanIndexForward: false },
   * )
   *
   * console.log(data)
   * // {
   * //   items: [
   * //     { id: '1', version: 3 },
   * //     { id: '1', version: 2 },
   * //     // ...
   * //   ]
   * // }
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by the total size of the response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   *   * `ConsistentRead` - true to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
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
      TableName: this.name,
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

      ...options.ConsistentRead ? { ConsistentRead: options.ConsistentRead } : {}
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
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * type DynamoDBJSONObject = Object<
   *   { S: string }
   *   |{ N: number }
   *   |{ B: Buffer }
   *   |{ L: Array<DynamoDBJSONObject> }
   *   |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * queryItemsIterator(
   *   keyConditionExpression string,
   *   Values DynamoDBJSONObject,
   *   options {
   *     BatchLimit: number,
   *     Limit: number,
   *     ScanIndexForward: boolean, // default true for ASC
   *   }
   * ) -> AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Table in DynamoDB JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const iter = userVersionTable.queryItemsIterator(
   *   'id = :id AND version > :version',
   *   { id: '1', version: 0 },
   *   { ScanIndexForward: true },
   * )
   *
   * for await (const item of iter) {
   *   console.log(item)
   *   // { id: { S: '1' }, version: { N: '1' } }
   *   // { id: { S: '1' }, version: { N: '2' } }
   *   // { id: { S: '1' }, version: { N: '3' } }
   *   // ...
   * }
   * ```
   *
   * Options:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call
   *   * `Limit` - Max number of items to yield from returned iterator
   *   * `ScanIndexForward` - true to sort items in ascending order
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
        Limit: Math.min(BatchLimit, Limit - numYielded)
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
        },
      )
      yield* response.Items
      numYielded += response.Items.length
    }
  }

  /**
   * @name queryItemsIteratorJSON
   *
   * @synopsis
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
   *   }
   * ) -> AsyncIterator<JSONObject>
   * ```
   *
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Table in JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const iter = userVersionTable.queryItemsIteratorJSON(
   *   'id = :id AND version > :version',
   *   { id: '1', version: 0 },
   *   { ScanIndexForward: true },
   * )
   *
   * for await (const item of iter) {
   *   console.log(item)
   *   // { id: '1', version: 1 }
   *   // { id: '1', version: 2 }
   *   // { id: '1', version: 3 }
   *   // ...
   * }
   * ```
   *
   * Options:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call
   *   * `Limit` - Max number of items to yield from returned iterator
   *   * `ScanIndexForward` - true to sort items in ascending order
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
        Limit: Math.min(BatchLimit, Limit - numYielded)
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
        },
      )
      yield* response.ItemsJSON
      numYielded += response.ItemsJSON.length
    }
  }
}

module.exports = DynamoDBTable
