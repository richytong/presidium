require('rubico/global')
const Transducer = require('rubico/Transducer')
const uniq = require('rubico/x/uniq')
const find = require('rubico/x/find')
const flatten = require('rubico/x/flatten')
const isDeepEqual = require('rubico/x/isDeepEqual')
const Dynamo = require('./internal/Dynamo')
const hashJSON = require('./internal/hashJSON')
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
 * @synopsis
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
 * }) -> index DynamoDBGlobalSecondaryIndex
 * ```
 *
 * @description
 * Creates a DynamoDB Global Secondary Index (GSI).
 *
 * ```javascript
 * // production
 * {
 *   const awsCreds = {
 *     accessKeyId: 'my-access-key-id',
 *     secretAccessKey: 'my-secret-access-key',
 *     region: 'my-region',
 *   }
 *
 *   const myProductionTable = new DynamoTable({
 *     name: 'my-production-table',
 *     key: [{ id: 'string' }],
 *     ...awsCreds,
 *   })
 *   await myProductionTable.ready
 *
 *   const myProductionStatusUpdateTimeIndex = new DynamoDBGlobalSecondaryIndex({
 *     table: 'my-production-table',
 *     key: [{ status: 'string' }, { updateTime: 'number' }],
 *     ...awsCreds,
 *   })
 *   await myProductionStatusUpdateTimeIndex.ready
 * }
 *
 * // local
 * {
 *   const myLocalTable = new DynamoTable({
 *     name: 'my-local-table',
 *     key: [{ id: 'string' }],
 *     endpoint: 'http://localhost:8000/',
 *   })
 *   await myLocalTable.ready
 *
 *   const myLocalStatusUpdateTimeIndex = new DynamoDBGlobalSecondaryIndex({
 *     table: 'my-local-table',
 *     key: [{ status: 'string' }, { updateTime: 'number' }],
 *     endpoint: 'http://localhost:8000/',
 *   })
 *   await myLocalStatusUpdateTimeIndex.ready
 * }
 * ```
 *
 * @note
 * [AWS DynamoDB Docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)

 */
class DynamoDBGlobalSecondaryIndex {
  constructor(options) {
    this.table = options.table
    this.key = options.key
    this.name = Dynamo.Indexname(this.key)
    this.dynamo = new Dynamo({
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint',
      ]),
      region: options.region ?? 'default-region',
    })
    this.client = this.dynamo.client

    this.ready = this.inspect().then(async () => {
      await this.waitForIndexStatus('ACTIVE')
      return { message: 'index-exists' }
    }).catch(async error => {
      if (error.message == `DynamoDB Global Secondary Index ${this.name} not found`) {
        await this.create()
        await this.waitForIndexStatus('ACTIVE')
        return { message: 'created-index' }
      }
      throw error
    })
  }

  /**
   * @name inspect
   *
   * @synopsis
   * ```coffeescript [specscript]
   * index.inspect() -> Promise<indexData object>
   * ```
   */
  async inspect() {
    const { Table } = await this.dynamo.describeTable(this.table)
    const indexData =
      Table.GlobalSecondaryIndexes?.find(eq(this.name, get('IndexName')))
    if (indexData == null) {
      throw new Error(`DynamoDB Global Secondary Index ${this.name} not found`)
    }
    return indexData
  }

  /**
   * @name create
   *
   * @synopsis
   * ```coffeescript [specscript]
   * index.create() -> Promise<indexData object>
   * ```
   */
  async create() {
    const indexData = await this.dynamo.createIndex(this.table, this.key)
      .then(pipe([
        get('TableDescription.GlobalSecondaryIndexes'),
        find(item => isDeepEqual(item.IndexName, this.name)),
      ]))
    if (indexData == null) {
      throw new Error(`DynamoDB Global Secondary Index ${this.name} not found`)
    }
    return indexData
  }

  /**
   * @name waitForIndexStatus
   *
   * @synopsis
   * ```coffeescript [specscript]
   * index.waitForIndexStatus(status string) -> Promise<>
   * ```
   */
  async waitForIndexStatus(status) {
    let hasDesiredStatus =
      await this.inspect().then(eq(status, get('IndexStatus')))
    while (!hasDesiredStatus) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      hasDesiredStatus = await this.inspect().then(eq(status, get('IndexStatus')))
    }
  }

  /**
   * @name query
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|binary },
   * }
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * index.query(
   *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
   *   values JSONKey|DynamoDBJSONKey,
   *   options {
   *     Limit: number,
   *     ExclusiveStartKey: Object<string=>DynamoAttributeValue>
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValueForFieldA'
   *   },
   * ) -> Promise<{ Items: Array<DynamoDBJSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB Global Secondary Index (GSI).
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
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
   * //   { id: 'a', status: 'pending', time: 1749565352158 },
   * //   { id: 'b', status: 'pending', time: 1749565352159 },
   * //   { id: 'c', status: 'pending', time: 1749565352160 },
   * //   ...
   * // ]
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by total size of response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   */
  query(keyConditionExpression, values, options = {}) {
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

    return this.client.query({
      TableName: this.table,
      IndexName: this.name,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      KeyConditionExpression,

      ScanIndexForward: options.ScanIndexForward ?? true,

      ...filterExpressionStatements.length > 0 ? { FilterExpression } : {},

      ...options.Limit ? { Limit: options.Limit } : {},

      ...options.ExclusiveStartKey ? {
        ExclusiveStartKey: options.ExclusiveStartKey,
      } : {},

      ...options.ProjectionExpression ? {
        ProjectionExpression: options.ProjectionExpression
          .split(',').map(field => `#${hashJSON(field)}`).join(','),
      } : {},
    }).promise()
  }

  /**
   * @name queryIterator
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * index.queryIterator(
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
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Global Secondary Index (GSI) in DynamoDB JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey type and sortKey time
   *
   * const iter = myIndex.queryIterator(
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
   *   * `BatchLimit` - Max number of items to retrieve per `query` call
   *   * `Limit` - Max number of items to yield from returned iterator
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   */
  async * queryIterator(keyConditionExpression, queryValues, options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    const Limit = options.Limit ?? Infinity
    const ScanIndexForward = options.ScanIndexForward ?? true

    let numYielded = 0
    let response = await this.query(
      keyConditionExpression,
      queryValues,
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
        queryValues,
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
   * @name queryIteratorJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   *
   * index.queryIteratorJSON(
   *   keyConditionExpression string,
   *   queryValues JSONObject,
   *   options {
   *     BatchLimit: number,
   *     Limit: number,
   *     ScanIndexForward: boolean, // default true for ASC
   *     ProjectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression: string, // 'fieldA >= :someValue'
   *   }
   * ) -> AsyncIterator<JSONObject>
   * ```
   *
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB Global Secondary Index (GSI) in JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // myIndex has hashKey type and sortKey time
   *
   * const iter = myIndex.queryIterator(
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
   *   * `BatchLimit` - Max number of items to retrieve per `query` call
   *   * `Limit` - Max number of items to yield from returned iterator
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   */
  queryIteratorJSON(...args) {
    return map(this.queryIterator(...args), map(Dynamo.attributeValueToJSON))
  }
}

module.exports = DynamoDBGlobalSecondaryIndex
