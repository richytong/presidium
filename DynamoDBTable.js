require('rubico/global')
const crypto = require('crypto')
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
 * @docs
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
 *   autoReady: boolean,
 *   BillingMode: 'PAY_PER_REQUEST'|'PROVISIONED',
 * }) -> table DynamoDBTable
 * ```
 *
 * Presidium DynamoDBTable client for [AWS DynamoDB](https://aws.amazon.com/dynamodb/). Creates the DynamoDB Table if it doesn't exist.
 *
 * DynamoDBTable instances have a `ready` promise that resolves when the table is active.
 *
 * Arguments:
 *   * `options`
 *     * `name` - the name of the DynamoDB Table.
 *     * `key` - the primary key of the DynamoDB Table.
 *     * `accessKeyId` - the AWS access key id.
 *     * `secretAccessKey` - the AWS secret access key.
 *     * `region` - the AWS region.
 *     * `autoReady` - whether to automatically create the DynamoDB Table if it doesn't exist. Defaults to `true`.
 *     * `BillingMode` - a mode that controls how read and write throughput is billed and how DynamoDB manages capacity for the DynamoDB Table.
 *
 * Return:
 *   * `table` - a DynamoDBTable instance.
 *
 * `BillingModes` values:
 *   * `PAY_PER_REQUEST` - on-demand capacity mode. The AWS account is billed per read and write request.
 *   * `PROVISIONED` - a capacity mode where the reads (RCUs) and writes (WCUs) are predefined.
 *
 * ```javascript
 * const awsCreds = await AwsCredentials('my-profile')
 * awsCreds.region = 'us-east-1'
 *
 * const myTable = new DynamoDBTable({
 *   name: 'my-table',
 *   key: [{ id: 'string' }],
 *   ...awsCreds,
 * })
 * ```
 *
 * References:
 *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
 */
class DynamoDBTable {
  constructor(options) {
    this.name = options.name
    this.key = options.key

    this.accessKeyId = options.accessKeyId ?? ''
    this.secretAccessKey = options.secretAccessKey ?? ''
    this.region = options.region ?? ''
    this.apiVersion = '2012-08-10'

    this.endpoint = `dynamodb.${this.region}.amazonaws.com`
    this.protocol = 'https'

    this.BillingMode = options.BillingMode ?? 'PAY_PER_REQUEST'
    if (this.BillingMode == 'PROVISIONED') {
      this.ProvisionedThroughput = options.ProvisionedThroughput ?? {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5
      }
    }

    this.http = new HTTP(`${this.protocol}://${this.endpoint}`)

    /**
     * @name ready
     *
     * @docs
     * ```coffeescript [specscript]
     * ready -> promise Promise<>
     * ```
     *
     * The ready promise for the DynamoDBTable instance. Resolves when the DynamoDB Table is active.
     *
     * ```javascript
     * const awsCreds = await AwsCredentials('default')
     * awsCreds.region = 'us-east-1'
     *
     * const env = process.env.NODE_ENV
     *
     * const myTable = new DynamoDBTable({
     *   name: `${env}-my-table`,
     *   key: [{ id: 'string' }],
     *   ...awsCreds,
     * })
     * await myTable.ready
     * ```
     */
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
   * @docs
   * ```coffeescript [specscript]
   * module AWSDynamoDBDocs 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Types.html'
   *
   * describe() -> data Promise<{ Table: AWSDynamoDBDocs.TableDescription }>
   * ```
   *
   * Returns information about the DynamoDB Table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `Table` - [`AWSDynamoDBDocs.TableDescription`](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TableDescription.html) - the DynamoDB Table properties.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const data = await myTable.describe()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * module AWSDynamoDBDocs 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Types.html'
   *
   * create() -> data Promise<{ TableDescription: AWSDynamoDBDocs.TableDescription }>
   * ```
   *
   * Creates the DynamoDB Table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `TableDescription` - [`AWSDynamoDBDocs.TableDescription`](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TableDescription.html) - the DynamoDB Table properties.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myTable.create()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * waitForActive() -> promise Promise<>
   * ```
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `promise` - a JavaScript promise that resolves when the DynamoDB Table is active.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myTable.create()
   * await myTable.waitForActive()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * waitForNotExists() -> promise Promise<>
   * ```
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `promise` - a JavaScript promise that resolves when the DynamoDB Table is deleted.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myTable.delete()
   * await myTable.waitForNotExists()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * closeConnections() -> undefined
   * ```
   *
   * Closes all underlying HTTP connections used by the DynamoDB Table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * undefined
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * // ...
   *
   * myTable.closeConnections()
   * ```
   */
  closeConnections() {
    this.http.closeConnections()
  }

  /**
   * @name delete
   *
   * @docs
   * ```coffeescript [specscript]
   * module AWSDynamoDBDocs 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Types.html'
   *
   * delete() -> data Promise<{ TableDescription: AWSDynamoDBDocs.TableDescription }>
   * ```
   *
   * Deletes the DynamoDB Table.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `data`
   *     * `TableDescription` - [`AWSDynamoDBDocs.TableDescription`](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TableDescription.html) - the DynamoDB Table properties.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: `${env}-my-table`,
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myTable.delete()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * putItem(Item DynamoDBJSONObject, options {
   *   ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *   ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *   ReturnValues: 'NONE'|'ALL_OLD',
   * }) -> data Promise<{
   *   Attributes: DynamoDBJSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * Writes an item to a DynamoDB Table using DynamoDB JSON format.
   *
   * Arguments:
   *   * `Item` - the full item in DynamoDB JSON format that will be written to the DynamoDB Table.
   *   * `options`
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnItemCollectionMetrics` - determines whether item collection metrics will be returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `Attributes` - the attribute values of the item in DynamoDB JSON format as they appeared before the [DynamoDB PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) operation. Requires `ReturnValues` to be specified as `ALL_OLD`.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnItemCollectionMetrics` values:
   *   * `SIZE` - the response will include statistics about item collections, if any.
   *   * `NONE` - no statistics will be returned in the response.
   *
   * `ReturnValues` values for `putItem`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - if the operation overwrote an item, then the attributes of the full old item is returned.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.putItem({
   *   id: { S: '1' },
   *   name: { S: 'Name' },
   *   age: { N: 32 },
   * })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
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
   * Writes an item to a DynamoDB Table using JSON format.
   *
   * Arguments:
   *   * `item` - the full item in JSON format that will be written to the DynamoDB Table.
   *   * `options`
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnItemCollectionMetrics` - determines whether item collection metrics will be returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `AttributesJSON` - the attribute values of the item in JSON format as they appeared before the [DynamoDB PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) operation. Requires `ReturnValues` to be specified as `ALL_OLD`.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB PutItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnItemCollectionMetrics` values (`putItemJSON` only):
   *   * `SIZE` - the response will include statistics about item collections, if any.
   *   * `NONE` - no statistics will be returned in the response.
   *
   * `ReturnValues` values for `putItemJSON`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - if the operation overwrote an item, then the attributes of the full old item is returned.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.putItemJSON({
   *   id: '1',
   *   name: 'Name',
   *   age: 32,
   * })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * getItem(Key DynamoDBJSONKey) -> data Promise<{ Item: DynamoDBJSONObject }>
   * ```
   *
   * Retrieves an item from a DynamoDB Table using DynamoDB JSON format.
   *
   * Arguments:
   *   * `Key` - the primary key in DynamoDB JSON format of the item to retrieve.
   *
   * Return:
   *   * `data`
   *     * `Item` - the full item in DynamoDB JSON format.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * const data = await userTable.getItem({ id: { S: '1' } })
   * console.log(data) // { Item: { id: { S: '1' }, name: { S: 'Name' } } }
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
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
   * Retrieves an item from a DynamoDB Table using JSON format.
   *
   * Arguments:
   *   * `key` - the primary key in JSON format of the item to retrieve.
   *
   * Return:
   *   * `data`
   *     * `ItemJSON` - the full item in JSON format.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * const data = await userTable.getItemJSON({ id: '1' })
   * console.log(data) // { ItemJSON: { id: '1', name: 'Name' } }
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * updateItem(
   *   Key DynamoDBJSONKey,
   *   Updates DynamoDBJSONObject,
   *   options {
   *     ConditionExpression: string,
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{
   *   Attributes: DynamoDBJSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * Updates an item in a DynamoDB Table using DynamoDB JSON format.
   *
   * Arguments:
   *   * `Key` - the primary key in DynamoDB JSON format of the item to update.
   *   * `Updates` - the item updates in DynamoDB JSON format.
   *   * `options`
   *     * `ConditionExpression` - a condition that must be satisfied in order for a conditional update to succeed.
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `Attributes` - the attribute values of the item in DynamoDB JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnValues` values for `updateItem`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `UPDATED_OLD` - returns only the updated attributes as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns all of the attributes of the item as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns only the updated attributes as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.updateItem({ id: { S: '1' } }, {
   *   name: { S: 'Name' },
   *   height: { N: 180 },
   *   heightUnits: { S: 'cm' },
   * })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### ConditionExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `ConditionExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `ConditionExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
   * References:
   *  * [Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
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
   *     ConditionExpression: string,
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{
   *   AttributesJSON: JSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * Updates an item in a DynamoDB Table using JSON format.
   *
   * Arguments:
   *   * `key` - the primary key in JSON format of the item to update.
   *   * `updates` - the item updates in JSON format.
   *   * `options`
   *     * `ConditionExpression` - a condition that must be satisfied in order for a conditional update to succeed.
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `AttributesJSON` - the attribute values of the item in JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnValues` values for `updateItemJSON`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `UPDATED_OLD` - returns only the updated attributes as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns all of the attributes of the item as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns only the updated attributes as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.updateItemJSON({ id: '1' }, {
   *   name: 'Name',
   *   height: 180,
   *   heightUnits: 'cm',
   * })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### ConditionExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `ConditionExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `ConditionExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
   * References:
   *  * [Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONIncrementObject = Object<{ N: number }>
   *
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * incrementItem(
   *   Key DynamoDBJSONKey,
   *   IncrementUpdates DynamoDBJSONIncrementObject,
   *   options {
   *     ConditionExpression: string,
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * Increments the attributes of an item using DynamoDB JSON syntax. A negative number will decrement the attribute value of an item.
   *
   * Arguments:
   *   * `Key` - the primary key in DynamoDB JSON format of the item to update.
   *   * `IncrementUpdates` - the item increment updates in DynamoDB JSON format.
   *   * `options`
   *     * `ConditionExpression` - a condition that must be satisfied in order for a conditional update to succeed.
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `Attributes` - the attribute values of the item in DynamoDB JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnValues` values for `incrementItem`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `UPDATED_OLD` - returns only the updated attributes as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns all of the attributes of the item as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns only the updated attributes as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.incrementItem({ id: { S: '1' } }, { age: { N: 1 } })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### ConditionExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `ConditionExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `ConditionExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
   * References:
   *  * [Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
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
   *     ConditionExpression: string,
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> data Promise<{ AttributesJSON: JSONObject }>
   * ```
   *
   * Increments the attributes of an item using JSON syntax. A negative number will decrement the attribute value of an item.
   *
   * Arguments:
   *   * `key` - the primary key in JSON format of the item to update.
   *   * `incrementUpdates` - the item increment updates in JSON format.
   *   * `options`
   *     * `ConditionExpression` - a condition that must be satisfied in order for a conditional update to succeed.
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `AttributesJSON` - the attribute values of the item in JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnValues` values for `incrementItemJSON`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `UPDATED_OLD` - returns only the updated attributes as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns all of the attributes of the item as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *   * `ALL_NEW` - returns only the updated attributes as they appear after the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.incrementItemJSON({ id: '1' }, { age: 1 })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### ConditionExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `ConditionExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `ConditionExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
   * References:
   *  * [Condition Expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * deleteItem(
   *   Key DynamoDBJSONKey,
   *   options {
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD',
   *   }
   * ) -> data Promise<{
   *   Attributes: DynamoDBJSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * Deletes an item from a DynamoDB Table using DynamoDB JSON format.
   *
   * Arguments:
   *   * `Key` - the primary key in DynamoDB JSON format of the item to delete.
   *   * `options`
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnItemCollectionMetrics` - determines whether item collection metrics will be returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `Attributes` - the attribute values of the item in DynamoDB JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB DeleteItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnItemCollectionMetrics` values:
   *   * `SIZE` - the response will include statistics about item collections, if any.
   *   * `NONE` - no statistics will be returned in the response.
   *
   * `ReturnValues` values for `deleteItem`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.deleteItem({ id: { S: '1' } })
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
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
   * ) -> data Promise<{
   *   AttributesJSON: JSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * Deletes an item from a DynamoDB Table using JSON format.
   *
   * Arguments:
   *   * `key` - the primary key in JSON format of the item to delete.
   *   * `options`
   *     * `ReturnConsumedCapacity` - determines the level of detail about provisioned or on-demand throughput consumption that is returned in the response.
   *     * `ReturnItemCollectionMetrics` - determines whether item collection metrics will be returned in the response.
   *     * `ReturnValues` - includes the item attributes in DynamoDB JSON format in the response. The values returned are strongly consistent. There is no additional cost or read capacity units consumed when with requesting a return value aside from the incurred network overhead.
   *
   * Return:
   *   * `data`
   *     * `AttributesJSON` - the attribute values of the item in JSON format.
   *     * `ConsumedCapacity` - the capacity units consumed by the [DynamoDB DeleteItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html) operation. `ConsumedCapacity` is only returned if the `ReturnConsumedCapacity` option is specified.
   *
   * `ReturnConsumedCapacity` values:
   *   * `INDEXES` - the response will include the aggregate consumed capacity (`ConsumedCapacity`) for the operation, together with the consumed capacity (`ConsumedCapacity`) for each table and secondary index that was accessed.
   *   * `TOTAL` - the response will include only the aggregate consumed capacity (`ConsumedCapacity`) for the operation.
   *   * `NONE` - no consumed capacity (`ConsumedCapacity`) details will be included in the response.
   *
   * `ReturnItemCollectionMetrics` values:
   *   * `SIZE` - the response will include statistics about item collections, if any.
   *   * `NONE` - no statistics will be returned in the response.
   *
   * `ReturnValues` values for `deleteItemJSON`:
   *   * `NONE` - no item attributes will be returned in the response.
   *   * `ALL_OLD` - returns all of the attributes of the item as they appeared before the [DynamoDB UpdateItem](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html) operation.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * await userTable.deleteItemJSON({ id: '1' })
   * ```
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
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
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * Returns an unordered, paginated list of items from a DynamoDB Table.
   *
   * Arguments:
   *   * `options`
   *     * `Limit` - the maximum number of items to return for the [DynamoDB Scan](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) operation. If the processed dataset size exceeds 1MB during the operation, DynamoDB will stop the operation before reaching the maximum number of items specified by `Limit`.
   *     * `ExclusiveStartKey` - the primary key of the first item that this operation will evaluate. This field should use the value of the `LastEvaluatedKey` returned from the last `scan` operation.
   *
   * Return:
   *   * `Items` - the list of items in DynamoDB JSON format from the [DynamoDB Scan](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) operation.
   *   * `Count` - the number of items in the response.
   *   * `ScannedCount` - the number of items that were evaluated during the operation, may be greater than or equal to `Count`.
   *   * `LastEvaluatedKey` - the primary key in DynamoDB JSON format of the last evaluated item of the [DynamoDB Scan](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html) operation in DynamoDB JSON format.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   * await userTable.ready
   *
   * const data = await userTable.scan()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * scanItemsIterator(options {
   *   BatchLimit: number,
   * }) -> asyncIterator AsyncIterator<Item DynamoDBJSONObject>
   * ```
   *
   * Returns an async iterator of all items in a DynamoDB Table in DynamoDB JSON format.
   *
   * Arguments:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call.
   *
   * Return:
   *   * `asyncIterator` - an async iterator of all items in DynamoDB JSON format in the DynamoDB Table.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   *
   * for await (const Item of userTable.scanItemsIterator()) {
   *   console.log(Item) // { id: { S: '1' }, name: { S: 'Name' } }
   *                     // { id: { S: '2' }, name: { S: 'Name' } }
   *                     // ...
   * }
   * ```
   *
   * References:
   *  * [AsyncIterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * scanItemsIteratorJSON(options {
   *   BatchLimit: number,
   * }) -> asyncIteratorJSON AsyncIterator<item JSONObject>
   * ```
   *
   * Returns an async iterator of all items in a DynamoDB Table in JSON format.
   *
   * Arguments:
   *   * `BatchLimit` - Max number of items to retrieve per `query` call.
   *
   * Return:
   *   * `asyncIteratorJSON` - an async iterator of all items in JSON format in the DynamoDB Table.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userTable = new DynamoDBTable({
   *   name: `${env}_user`,
   *   key: [{ id: 'string' }]
   *   ...awsCreds,
   * })
   *
   * for await (const item of userTable.scanItemsIteratorJSON()) {
   *   console.log(item) // { id: '1', name: 'Name' }
   *                     // { id: '2', name: 'Name' }
   *                     // ...
   * }
   * ```
   *
   * References:
   *  * [AsyncIterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * @docs
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { S: string }|{ N: number }|{ B: Buffer },
   *   [sortKey string]: { S: string }|{ N: number }|{ B: Buffer },
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * query(
   *   keyConditionExpression string,
   *   Values DynamoDBJSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string,
   *     ConsistentRead: boolean,
   *   },
   * ) -> data Promise<{
   *   Items: Array<DynamoDBJSONObject>,
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * Query a DynamoDB Table using DynamoDB JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the DynamoDB Table.
   *   * `Values` - DynamoDB JSON values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `Limit` - the maximum number of items to return for the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation. If the processed dataset size exceeds 1MB during the operation, DynamoDB will stop the operation before reaching the maximum number of items specified by `Limit`.
   *     * `ExclusiveStartKey` - the key after which to start reading.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *     * `ConsistentRead` - whether to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   *
   * Return:
   *   * `data`
   *     * `Items` - the items in DynamoDB JSON format returned from the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation.
   *     * `LastEvaluatedKey` - the primary key of the item in DynamoDB JSON format where the query stopped.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userVersionTable = new DynamoDBTable({
   *   name: `${env}_user_version`,
   *   key: [{ id: 'string' }, { version: 'string' }]
   *   ...awsCreds,
   * })
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
   * //   ],
   * //   LastEvaluatedKey: { id: { S: '51' }, version: { N: '121' } },
   * // }
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### FilterExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `FilterExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `FilterExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
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
   *   keyConditionExpression string,
   *   values JSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string,
   *     ConsistentRead: boolean,
   *   },
   * ) -> Promise<{
   *   ItemsJSON: Array<JSONObject>,
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * Query a DynamoDB Table using JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the DynamoDB Table.
   *   * `values` - JSON values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `Limit` - the maximum number of items to return for the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation. If the processed dataset size exceeds 1MB during the operation, DynamoDB will stop the operation before reaching the maximum number of items specified by `Limit`.
   *     * `ExclusiveStartKey` - the key after which to start reading.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *     * `ConsistentRead` - whether to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   *
   * Return:
   *   * `data`
   *     * `ItemsJSON` - the items in JSON format returned from the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation.
   *     * `LastEvaluatedKey` - the primary key of the item in DynamoDB JSON format where the query stopped.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userVersionTable = new DynamoDBTable({
   *   name: `${env}_user_version`,
   *   key: [{ id: 'string' }, { version: 'string' }]
   *   ...awsCreds,
   * })
   *
   * const data = await userVersionTable.queryJSON(
   *   'id = :id AND version > :version',
   *   { id: { S: '1' }, version: { N: '0' } },
   *   { ScanIndexForward: false },
   * )
   *
   * console.log(data)
   * // {
   * //   ItemsJSON: [
   * //     { id: '1', version: '3' },
   * //     { id: '1', version: '2' },
   * //     // ...
   * //   ],
   * //   LastEvaluatedKey: { id: { S: '51' }, version: { N: '121' } },
   * // }
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### FilterExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `FilterExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `FilterExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
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
   * @docs
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * queryItemsIterator(
   *   keyConditionExpression string,
   *   Values DynamoDBJSONObject,
   *   options {
   *     BatchLimit: number,
   *     Limit: number,
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string,
   *     ConsistentRead: boolean,
   *   }
   * ) -> asyncIterator AsyncIterator<Item DynamoDBJSONObject>
   * ```
   *
   * Returns an async iterator of all items represented by a query on a DynamoDB Table in DynamoDB JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the Global Secondary Index.
   *   * `Values` - DynamoDB JSON values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `BatchLimit` - Maximum number of items to retrieve per `query` call.
   *     * `Limit` - the maximum number of items to return for the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation. If the processed dataset size exceeds 1MB during the operation, DynamoDB will stop the operation before reaching the maximum number of items specified by `Limit`.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *     * `ConsistentRead` - whether to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   *
   * Return:
   *   * `asyncIterator` - an async iterator of all items in DynamoDB JSON format represented by the query on the DynamoDB Table.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userVersionTable = new DynamoDBTable({
   *   name: `${env}_user_version`,
   *   key: [{ id: 'string' }, { version: 'string' }]
   *   ...awsCreds,
   * })
   *
   * const iter = await userVersionTable.queryItemsIterator(
   *   'id = :id AND version > :version',
   *   { id: { S: '1' }, version: { N: '0' } },
   *   { ScanIndexForward: false },
   * )
   *
   * for await (const item of iter) {
   *   console.log(Item) // { id: { S: '1' }, version: { S: '1' }, name: { S: 'Name' } }
   *                     // { id: { S: '1' }, version: { S: '2' }, name: { S: 'Name' } }
   *                     // ...
   * }
   * ```
   *
   * References:
   *  * [AsyncIterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
   * ### FilterExpression Syntax
   * ```sh [DynamoDB_ConditionExpression_Syntax]
   * <attribute_name> = :<variable_name>
   * <attribute_name> <> :<variable_name>
   * <attribute_name> < :<variable_name>
   * <attribute_name> <= :<variable_name>
   * <attribute_name> > :<variable_name>
   * <attribute_name> >= :<variable_name>
   *
   * <attribute_name> BETWEEN :<variable_name1> AND :<variable_name2>
   *
   * <attribute_name> IN (:<variable_name1>[, :<variable_name2>[, ...]])
   *
   * <function_name>(<attribute_name>[, :<variable_name>])
   *
   * <function_name>(<attribute_name>[, :<variable_name1>]) = :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <> :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) < :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) <= :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) > :<variable_name2>
   * <function_name>(<attribute_name>[, :<variable_name1>]) >= :<variable_name2>
   *
   * <expression> AND <expression>
   *
   * NOT <expression>
   *
   * (<expression>)
   * ```
   *
   * `FilterExpression` Functions:
   *   * `attribute_exists(<attribute_name>)` - test if `<attribute_name>` exists.
   *   * `attribute_not_exists(<attribute_name>)` - test if `<attribute_name>` does not exist.
   *   * `attribute_type(<attribute_name>, <attribute_type>)` - test if the DynamoDB attribute type of the DynamoDB attribute value of `<attribute_name>` equals `attribute_type`.
   *   * `contains(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `begins_with(<attribute_name>, :<variable_name>)` - test if the DynamoDB attribute value of `<attribute_name>` equals the attribute value provided in `Updates` corresponding to `<variable_name>`.
   *   * `size(<attribute_name>)` - returns for evaluation a number that represents the size of the attribute value of `<attribute_name>`
   *
   * `FilterExpression` Logical Operators:
   *   * `=` - equals.
   *   * `<>` - does not equal.
   *   * `<` - less than.
   *   * `>` - greater than.
   *   * `<=` - less than or equal to .
   *   * `>=` - greater than or equal to.
   *   * `BETWEEN` - between.
   *   * `IN` - in.
   *   * `AND` - and.
   *   * `OR` - or.
   *   * `NOT` - not.
   *
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
        ...pick(options, ['ProjectionExpression', 'FilterExpression', 'ConsistentRead']),
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
          ...pick(options, ['ProjectionExpression', 'FilterExpression', 'ConsistentRead']),
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
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string,
   *     ConsistentRead: boolean,
   *   }
   * ) -> asyncIteratorJSON AsyncIterator<ItemJSON JSONObject>
   * ```
   *
   * Returns an async iterator of all items represented by a query on a DynamoDB Table in JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the Global Secondary Index.
   *   * `values` - JSON values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `BatchLimit` - Maximum number of items to retrieve per `query` call.
   *     * `Limit` - the maximum number of items to return for the [DynamoDB Query](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Query.html) operation. If the processed dataset size exceeds 1MB during the operation, DynamoDB will stop the operation before reaching the maximum number of items specified by `Limit`.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *     * `ConsistentRead` - whether to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   *
   * Return:
   *   * `asyncIteratorJSON` - an async iterator of all items in JSON format represented by the query on the DynamoDB Table.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const env = process.env.NODE_ENV
   *
   * const userVersionTable = new DynamoDBTable({
   *   name: `${env}_user_version`,
   *   key: [{ id: 'string' }, { version: 'string' }]
   *   ...awsCreds,
   * })
   *
   * const iter = userVersionTable.queryItemsIteratorJSON(
   *   'id = :id AND version > :version',
   *   { id: '1', version: 0 },
   *   { ScanIndexForward: true },
   * )
   *
   * for await (const item of iter) {
   *   console.log(item)
   *   // { id: '1', version: '1' }
   *   // { id: '1', version: '2' }
   *   // { id: '1', version: '3' }
   *   // ...
   * }
   * ```
   *
   * References:
   *  * [AsyncIterator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncIterator)
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   *
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
        ...pick(options, ['ProjectionExpression', 'FilterExpression', 'ConsistentRead']),
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
          ...pick(options, ['ProjectionExpression', 'FilterExpression', 'ConsistentRead']),
        },
      )
      yield* response.ItemsJSON
      numYielded += response.ItemsJSON.length
    }
  }
}

module.exports = DynamoDBTable
