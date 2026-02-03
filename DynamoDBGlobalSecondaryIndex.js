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
 *   table: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   autoReady: boolean,
 * }) -> gsi DynamoDBGlobalSecondaryIndex
 * ```
 *
 * Presidium DynamoDBGlobalSecondaryIndex client for [AWS DynamoDB](https://aws.amazon.com/dynamodb/). Creates the DynamoDB Global Secondary Index (GSI) if it doesn't exist.
 *
 * DynamoDBGlobalSecondaryIndex instances have a `ready` promise that resolves when the GSI is active.
 *
 * Arguments:
 *   * `options`
 *     * `table` - the name of the DynamoDB Table to which the DynamoDB Global Secondary Index belongs.
 *     * `key` - the primary key of the DynamoDB Global Secondary Index.
 *     * `accessKeyId` - the AWS access key id.
 *     * `secretAccessKey` - the AWS secret access key.
 *     * `region` - the AWS region.
 *     * `autoReady` - whether to automatically create the DynamoDB Global Secondary Index if it doesn't exist. Defaults to `true`.
 *
 * Return:
 *   * `gsi` - a DynamoDBGlobalSecondaryIndex instance.
 *
 * ```javascript
 * const awsCreds = await AwsCredentials('my-profile')
 * awsCreds.region = 'us-east-1'
 *
 * const env = process.env.NODE_ENV
 *
 * const myTable = new DynamoTable({
 *   name: `${env}-my-table`,
 *   key: [{ id: 'string' }],
 *   ...awsCreds,
 * })
 * await myTable.ready
 *
 * const myStatusUpdateTimeGSI = new DynamoDBGlobalSecondaryIndex({
 *   table: `${env}-my-table`,
 *   key: [{ status: 'string' }, { updateTime: 'number' }],
 *   ...awsCreds,
 * })
 * ```
 *
 * References:
 *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
     * The ready promise for the DynamoDBGlobalSecondaryIndex instance. Resolves when the DynamoDB Global Secondary Index is active.
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
     *
     * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
     *   table: `${env}-my-table`,
     *   key: [{ type: 'string' }, { time: 'number' }],
     *   ...awsCreds,
     * })
     * await myTypeTimeGSI.ready
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
   * module AWSDynamoDBDocs 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Types.html'
   *
   * describeTable() -> data Promise<{
   *   Table: AWSDynamoDBDocs.TableDescription,
   * }>
   * ```
   *
   * Returns information about the DynamoDB Table of the DynamoDB Global Secondary Index.
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
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myTypeTimeGSI.ready
   *
   * const data = await myTypeTimeGSI.describeTable()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * module AWSDynamoDBDocs 'https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Types.html'
   *
   * describe() -> indexData Promise<{
   *   IndexArn: string,
   *   IndexName: string,
   *   IndexStatus: 'CREATING'|'UPDATING'|'DELETING'|'ACTIVE',
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
   *
   * Returns information about the DynamoDB Global Secondary Index.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `IndexArn` - the ARN (Amazon Resource Name) of the Global Secondary Index.
   *   * `IndexName` - the name of the Global Secondary Index.
   *   * `IndexStatus` - the currentn status of the Global Secondary Index.
   *   * `KeySchema` - the [key schema](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_KeySchemaElement.html) of the Global Secondary Index.
   *   * `BillingModeSummary` - information about the read/write capacity mode of the Global Secondary Index.
   *     * `BillingMode` - a mode that controls how read and write throughput is billed and how DynamoDB manages capacity for the Global Secondary Index.
   *   * `ProvisionedThroughput` - information about the provisioned throughput settings of the Global Secondary Index.
   *     * `ReadCapacityUnits` - number of 4KB strong reads per second.
   *     * `WriteCapacityUnits` - number of 1KB writes per second.
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
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myTypeTimeGSI.ready
   *
   * const data = await myTypeTimeGSI.describe()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   *
   * Creates the DynamoDB Global Secondary Index.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `IndexArn` - the ARN (Amazon Resource Name) of the Global Secondary Index.
   *   * `IndexName` - the name of the Global Secondary Index.
   *   * `IndexStatus` - the currentn status of the Global Secondary Index.
   *   * `KeySchema` - the [key schema](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_KeySchemaElement.html) of the Global Secondary Index.
   *   * `BillingModeSummary` - information about the read/write capacity mode of the Global Secondary Index.
   *     * `BillingMode` - a mode that controls how read and write throughput is billed and how DynamoDB manages capacity for the Global Secondary Index.
   *   * `ProvisionedThroughput` - information about the provisioned throughput settings of the Global Secondary Index.
   *     * `ReadCapacityUnits` - number of 4KB strong reads per second.
   *     * `WriteCapacityUnits` - number of 1KB writes per second.
   *
   * Billing Modes:
   *   * `PAY_PER_REQUEST` - on-demand capacity mode. The AWS account is billed per read and write request.
   *   * `PROVISIONED` - a capacity mode where the reads (RCUs) and writes (WCUs) are predefined.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   *   autoReady: false,
   * })
   *
   * await myTypeTimeGSI.create()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
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
   * waitForActive() -> promise Promise<>
   * ```
   *
   * Waits for the DynamoDB Global Secondary Index to be active.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `promise` - a JavaScript promise that resolves when the DynamoDB Global Secondary Index is active.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   *
   * await myTypeTimeGSI.waitForActive()
   * ```
   *
   * References:
   *  * [AWS DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)
   */
  async waitForActive() {
    let indexData = await this.describe()
    while (indexData.IndexStatus != 'ACTIVE') {
      await sleep(100)
      indexData = await this.describe()
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
   *   keyConditionExpression string, # 'hashKey = :a AND sortKey < :b'
   *   Values DynamoDBJSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, # 'fieldA >= :someValue'
   *   },
   * ) -> data Promise<{
   *   Items: Array<DynamoDBJSONObject>,
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * Query a DynamoDB Global Secondary Index using DynamoDB JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the Global Secondary Index.
   *   * `Values` - DynamoDB JSON values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *     * `ExclusiveStartKey` - the primary key after which to start reading.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *
   * Return:
   *   * `data`
   *     * `Items` - the items of the DynamoDB Global Secondary Index returned from the query.
   *     * `LastEvaluatedKey` - the primary key of the item where the query stopped.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myStatusTimeIndex = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ status: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myStatusTimeIndex.ready
   *
   * const pendingItemsLast24h = await myStatusTimeIndex.query(
   *   'status = :status AND time > :time',
   *   {
   *     status: { S: 'pending' },
   *     time: { N: Date.now() - (24 * 60 * 60 * 1000) },
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
   * type DynamoDBJSONObject = Object<
   *   [key string]: { S: string }
   *                 |{ N: number }
   *                 |{ B: Buffer }
   *                 |{ L: Array<DynamoDBJSONObject> }
   *                 |{ M: Object<DynamoDBJSONObject> }
   * >
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * queryJSON(
   *   keyConditionExpression string, # 'hashKey = :a AND sortKey < :b'
   *   values JSONObject,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: DynamoDBJSONKey,
   *     ScanIndexForward: boolean, # defaults to true for ASC
   *     ProjectionExpression: string, # 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, # 'fieldA >= :someValue'
   *   },
   * ) -> data Promise<{
   *   ItemsJSON: Array<JSONObject>,
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * Query a DynamoDB Global Secondary Index using JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * Arguments:
   *   * `keyConditionExpression` - a query on the hash key and/or sort key of the Global Secondary Index.
   *   * `values` - values for each variable (prefixed by `:`) of the query.
   *   * `options`
   *     * `Limit` - Maximum number of items (hard limited by the total size of the response).
   *     * `ExclusiveStartKey` - the primary key after which to start reading.
   *     * `ScanIndexForward` - if `true`, returned items are sorted in ascending order. If `false` returned items are sorted in descending order. Defaults to `true`.
   *     * `ProjectionExpression` - list of comma-separated attribute names to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`.
   *     * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`.
   *
   * Return:
   *   * `data`
   *     * `ItemsJSON` - the items of the DynamoDB Global Secondary Index returned from the query.
   *     * `LastEvaluatedKey` - the primary key of the item where the query stopped.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myStatusTimeIndex = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ status: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myStatusTimeIndex.ready
   *
   * const pendingItemsJSONLast24h = await myStatusTimeIndex.queryJSON(
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
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   }
   * ) -> asyncIterator AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * Returns an async iterator of all items represented by a query on a DynamoDB Global Secondary Index (GSI) in DynamoDB JSON format.
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
   *
   * Return:
   *   * `asyncIterator` - an async iterator of all items in DynamoDB JSON format represented by the query on the DynamoDB Global Secondary Index.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myTypeTimeGSI.ready
   *
   * const iter = myTypeTimeGSI.queryItemsIterator(
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
   * ) -> asyncIteratorJSON AsyncIterator<JSONObject>
   * ```
   *
   * Returns an async iterator of all items represented by a query on a DynamoDB Global Secondary Index (GSI) in JSON format.
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
   *
   * Return:
   *   * `asyncIteratorJSON` - an async iterator of all items in JSON format represented by the query on the DynamoDB Global Secondary Index.
   *
   * ```javascript
   * const awsCreds = await AwsCredentials('my-profile')
   * awsCreds.region = 'us-east-1'
   *
   * const myTable = new DynamoDBTable({
   *   name: 'my-table'
   *   key: [{ id: 'string' }],
   *   ...awsCreds,
   * })
   * await myTable.ready
   *
   * const myTypeTimeGSI = new DynamoDBGlobalSecondaryIndex({
   *   table: 'my-table',
   *   key: [{ type: 'string' }, { time: 'number' }],
   *   ...awsCreds,
   * })
   * await myTypeTimeGSI.ready
   *
   * const iter = myTypeTimeGSI.queryItemsIterator(
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
