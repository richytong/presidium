require('rubico/global')
const { identity } = require('rubico/x')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const Dynamo = require('./internal/Dynamo')
const hashJSON = require('./internal/hashJSON')
const join = require('./internal/join')
const createExpressionAttributeNames =
  require('./internal/createExpressionAttributeNames')
const createExpressionAttributeValues =
  require('./internal/createExpressionAttributeValues')
const createKeyConditionExpression =
  require('./internal/createKeyConditionExpression')
const createFilterExpression = require('./internal/createFilterExpression')

/**
 * @name DynamoTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DynamoTable(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint?: string,
 * }) -> DynamoTable
 * ```
 *
 * @description
 * Creates a DynamoDB table.
 *
 * ```javascript
 * // local testing
 * const myLocalTable = new DynamoTable({
 *   name: 'my-local-table',
 *   key: [{ id: 'string' }],
 *   endpoint: 'http://localhost:8000/',
 * })
 * await myLocalTable.ready
 *
 * // production
 * const myProductionTable = new DynamoTable({
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
class DynamoTable {
  constructor(options) {
    this.name = options.name
    this.key = options.key
    this.dynamo = new Dynamo({
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint',
      ]),
      region: options.region ?? 'default-region',
    })
    this.client = this.dynamo.client
    this.ready = this.exists().then(async () => {
      await this.dynamo.waitFor(this.name, 'tableExists')
      return { message: 'table-exists' }
    }).catch(async () => {
      await this.dynamo.createTable(this.name, options.key)
      await this.dynamo.waitFor(this.name, 'tableExists')
      return { message: 'created-table' }
    })
  }

  /**
   * @name exists
   *
   * @synopsis
   * ```coffeescript [specscript]
   * exists() -> Promise<>
   * ```
   */
  async exists() {
    await this.dynamo.describeTable(this.name)
  }

  /**
   * @name delete
   *
   * @synopsis
   * ```coffeescript [specscript]
   * delete() -> Promise<>
   * ```
   *
   * @description
   * Delete the DynamoDB table.
   *
   * ```javascript
   * await myTable.delete()
   * ```
   */
  async delete() {
    await this.dynamo.deleteTable(this.name)
    await this.dynamo.waitFor(this.name, 'tableNotExists')
  }

  /**
   * @name putItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * putItem(
   *   item JSONObject|DynamoDBJSONObject,
   *   options? {
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD',
   *   }
   * ) -> Promise<{
   *   Attributes?: {...},
   *   ConsumedCapacity?: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * @description
   * Write an item to a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * // insert or update an item using DynamoDB JSON
   * await userTable.putItem({
   *   id: { S: '1' },
   *   name: { S: 'John' },
   *   age: { N: 32 },
   * })
   *
   * // insert or update an item using JSON
   * await userTable.putItem({
   *   id: '1',
   *   name: 'John',
   *   age: 32,
   * })
   * ```
   *
   * @note
   * [AWS DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
   */
  putItem(item, options = {}) {
    return this.client.putItem({
      TableName: this.name,
      Item:
        Dynamo.isDynamoDBJSON(item)
        ? item
        : map(item, Dynamo.AttributeValue),
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'putItem'
      error.item = item
      throw error
    })
  }

  /**
   * @name getItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * getItem(key JSONKey|DynamoDBJSONKey) -> Promise<{
   *   Item: DynamoDBJSONObject,
   * }>
   * ```
   *
   * @description
   * Retrieve an item from a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * { // get an item using DynamoDB JSON
   *   const res = await userTable.getItem({ id: { S: '1' } })
   *   console.log(res) // { Item: { id: { S: '1' }, name: { S: 'John' } } }
   * }
   *
   * { // get an item using JSON
   *   const res = await userTable.getItem({ id: '1' })
   *   console.log(res) // { Item: { id: { S: '1' }, name: { S: 'John' } } }
   * }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  getItem(key) {
    return this.client.getItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),
    }).promise().then(result => {
      if (result.Item == null) {
        const error = new Error(`Item not found for ${JSON.stringify(key)}`)
        error.tableName = this.name
        throw error
      }
      return result
    }).catch(error => {
      error.tableName = this.name
      error.method = 'getItem'
      error.key = key
      throw error
    })
  }

  /**
   * @name getItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   *
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   *
   * getItemJSON(key JSONKey|DynamoDBJSONKey) -> Promise<JSONObject>
   * ```
   *
   * @description
   * Retrieve an item in JSON format from a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * { // get a user using DynamoDB JSON
   *   const user = await userTable.getItemJSON({ id: { S: '1' } })
   *   console.log(user) // { id: '1', name: 'John' }
   * }
   *
   * { // get a user using JSON
   *   const user = await userTable.getItemJSON({ id: '1' })
   *   console.log(user) // { id: '1', name: 'John' }
   * }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  getItemJSON(key) {
    return this.client.getItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),
    }).promise().then(pipe([
      result => {
        if (result.Item == null) {
          const error = new Error(`Item not found for ${JSON.stringify(key)}`)
          error.tableName = this.name
          throw error
        }
        return result.Item
      },
      map(Dynamo.attributeValueToJSON),
    ])).catch(error => {
      error.tableName = this.name
      error.method = 'getItemJSON'
      error.key = key
      throw error
    })
  }

  /**
   * @name updateItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   *
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * updateItem(
   *   key JSONKey|DynamoDBJSONKey,
   *   updates JSONObject|DynamoDBJSONObject,
   *   options? {
   *     ConditionExpression?: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   },
   * ) -> Promise<{ Attributes?: object }>
   * ```
   *
   * @description
   * Update an item in a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * // update a user's name and height using DynamoDB JSON
   * await userTable.updateItem({ id: { S: '1' } }, {
   *   name: { S: 'George' },
   *   height: { N: 180 },
   *   heightUnits: { S: 'cm' },
   * })
   *
   * // update a user's name and height using JSON
   * await userTable.updateItem({ id: '1' }, {
   *   name: 'George',
   *   height: 180,
   *   heightUnits: 'cm',
   * })
   * ```
   *
   * @note
   * [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
   */
  updateItem(key, updates, options = {}) {
    const jsonUpdates =
      Dynamo.isDynamoDBJSON(updates)
      ? map(updates, Dynamo.attributeValueToJSON)
      : updates

    return this.client.updateItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),

      UpdateExpression: pipe(jsonUpdates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
        join(', '),
        expression => `set ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(jsonUpdates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(jsonUpdates, ([key, value]) => [
          `:${hashJSON(value)}`,
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'updateItem'
      error.key = key
      error.jsonUpdates = jsonUpdates
      throw error
    })
  }

  /**
   * @name incrementItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   *
   * type JSONIncrementObject = Object<[key string]: number>
   * type DynamoDBJSONIncrementObject = Object<[key string]: { N: number }>
   *
   * incrementItem(
   *   key JSONKey|DynamoDBJSONKey,
   *   incrementUpdates JSONIncrementObject|DynamoDBJSONIncrementObject,
   *   options? {
   *     ConditionExpression?: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   },
   * ) -> Promise<{ Attributes?: object }>
   * ```
   *
   * @description
   * Increment the attributes of an item in a DynamoDB table. Negative numbers will decrement the attribute of the item. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * // increase user's age by 1 using DynamoDB JSON
   * await userTable.incrementItem({ id: { S: '1' } }, { age: { N: 1 } })
   *
   * // increase user's age by 1 using JSON
   * await userTable.incrementItem({ id: '1' }, { age: 1 })
   * ```
   */
  incrementItem(key, incrementUpdates, options = {}) {
    const jsonIncrementUpdates =
      Dynamo.isDynamoDBJSON(incrementUpdates)
      ? map(incrementUpdates, Dynamo.attributeValueToJSON)
      : incrementUpdates

    return this.client.updateItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),

      UpdateExpression: pipe(jsonIncrementUpdates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} :${hashJSON(value)}`),
        join(', '),
        expression => `add ${expression}`,
      ]),

      ExpressionAttributeNames:
        map.entries(jsonIncrementUpdates, ([key, value]) => [
          `#${hashJSON(key)}`,
          key,
        ]),

      ExpressionAttributeValues:
        map.entries(jsonIncrementUpdates, ([key, value]) => [
          `:${hashJSON(value)}`,
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().then(all({
      dynamodb: identity,
    })).catch(error => {
      error.tableName = this.name
      error.method = 'incrementItem'
      error.key = key
      error.jsonIncrementUpdates = jsonIncrementUpdates
      throw error
    })
  }

  /**
   * @name deleteItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   *
   * deleteItem(
   *   key JSONKey|DynamoDBJSONKey,
   *   options? {
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD',
   *   },
   * ) -> Promise<{ Item?: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Delete an item from a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * // increase delete user with id '1' using DynamoDB JSON
   * await userTable.deleteItem({ id: { S: '1' } })
   *
   * // increase delete user with id '1' using JSON
   * await userTable.deleteItem({ id: '1' })
   * ```
   */
  deleteItem(key, options) {
    return this.client.deleteItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'deleteItem'
      error.key = key
      throw error
    })
  }

  /**
   * @name scan
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   *
   * scan(options {
   *   Limit: number,
   *   ExclusiveStartKey: DynamoDBJSONKey,
   * }) -> Promise<{
   *   Items: Array<DynamoDBJSONObject>>
   *   Count: number,
   *   ScannedCount: number,
   *   LastEvaluatedKey: DynamoDBJSONKey,
   * }>
   * ```
   *
   * @description
   * Get an unordered, paginated list of items from a DynamoDB table.
   *
   * ```javascript
   * const scanResponse = await userTable.scan()
   * console.log(userItems) // [{ id: { S: '1' }, name: { S: 'John' } }, ...]
   * ```
   */
  scan(options = {}) {
    return this.client.scan({
      TableName: this.name,
      Limit: options.Limit ?? 1000,
      ...options.ExclusiveStartKey ? {
        ExclusiveStartKey: options.ExclusiveStartKey,
      } : {},
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'scan'
      error.options = options
      throw error
    })
  }

  /**
   * @name scanIterator
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * scanIterator(options? {
   *   BatchLimit?: number,
   * }) -> AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * @description
   * Get an async iterator of all items from a DynamoDB table.
   */
  async * scanIterator(options = {}) {
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
   * @name scanIteratorJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONObject = Object<[key string]: string|number|binary|Array|Object>
   *
   * scanIteratorJSON(options?: {
   *   BatchLimit?: number,
   * }) -> AsyncIterator<JSONObject>
   * ```
   *
   * @description
   * Get an async iterator of all items from a DynamoDB table in JSON format.
   */
  async * scanIteratorJSON(options = {}) {
    const BatchLimit = options.BatchLimit ?? 1000
    let response = await this.scan({ Limit: BatchLimit })
    yield* map(response.Items, map(Dynamo.attributeValueToJSON))
    while (response.LastEvaluatedKey != null) {
      response = await this.scan({
        Limit: BatchLimit,
        ExclusiveStartKey: response.LastEvaluatedKey,
      })
      yield* map(response.Items, map(Dynamo.attributeValueToJSON))
    }
  }

  /**
   * @name query
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|binary },
   *   [sortKey string]?: { ['S'|'N'|'B']: string|number|binary },
   * }
   * type DynamoDBJSONObject = Object<[key string]: {
   *   ['S'|'N'|'B'|'L'|'M']:
   *     string|number|binary|Array<DynamoDBJSONObject>|DynamoDBJSONObject,
   * }>
   *
   * query(
   *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
   *   values JSONKey|DynamoDBJSONKey,
   *   options? {
   *     Limit?: number,
   *     ExclusiveStartKey?: DynamoDBJSONKey,
   *     ScanIndexForward?: boolean, // default true for ASC
   *     ProjectionExpression?: string, // 'fieldA,fieldB,fieldC'
   *     FilterExpression?: string, // 'fieldA >= :someValue'
   *     ConsistentRead?: boolean, // true to perform a strongly consistent read (eventually consistent by default)
   *   },
   * ) -> Promise<{ Items: Array<DynamoDBJSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB table. Use the hash and sort keys as query parameters and to construct the key condition expression.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * { // query userVersions using DynamoDB JSON
   *   const userVersions = await userVersionTable.query(
   *     'id = :id AND version > :version',
   *     { id: '1', version: 0 },
   *     { ScanIndexForward: false },
   *   )
   *   console.log(userVersions)
   *   // [
   *   //   { id: { S: '1' }, version: { N: 3 } },
   *   //   { id: { S: '1' }, version: { N: 2 } },
   *   //   ...
   *   // ]
   * }
   *
   * { // query userVersions using JSON
   *   const userVersions = await userVersionTable.query(
   *     'id = :id AND version > :version',
   *     { id: '1', version: 0 },
   *     { ScanIndexForward: false },
   *   )
   *   console.log(userVersions)
   *   // [
   *   //   { id: { S: '1' }, version: { N: 3 } },
   *   //   { id: { S: '1' }, version: { N: 2 } },
   *   //   ...
   *   // ]
   * }
   * ```
   *
   * Options:
   *   * `Limit` - Maximum number of items (hard limited by total size of response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   *   * `ConsistentRead` - true to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
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
      TableName: this.name,
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

      ...options.ConsistentRead ? { ConsistentRead: options.ConsistentRead } : {},
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
   * queryIterator(
   *   keyConditionExpression string,
   *   queryValues JSONObject,
   *   options? {
   *     BatchLimit?: number,
   *     Limit?: number,
   *     ScanIndexForward?: boolean, // default true for ASC
   *   }
   * ) -> AsyncIterator<DynamoDBJSONObject>
   * ```
   *
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB table in DynamoDB JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const iter = userVersionTable.queryIterator(
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
   * queryIteratorJSON(
   *   keyConditionExpression string,
   *   queryValues JSONObject,
   *   options? {
   *     BatchLimit?: number,
   *     Limit?: number,
   *     ScanIndexForward?: boolean, // default true for ASC
   *   }
   * ) -> AsyncIterator<JSONObject>
   * ```
   *
   * @description
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB table in JSON format.
   *
   * The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const iter = userVersionTable.queryIteratorJSON(
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
  queryIteratorJSON(...args) {
    return map(this.queryIterator(...args), map(Dynamo.attributeValueToJSON))
  }
}

module.exports = DynamoTable
