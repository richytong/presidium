require('rubico/global')
const { identity } = require('rubico/x')
require('aws-sdk/lib/maintenance_mode_message').suppress = true
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
 * Creates a DynamoDB table.
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
   * table.exists() -> Promise<>
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
   * table.delete() -> Promise<>
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
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.putItem(item DynamoDBJSONObject, options {
   *   ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *   ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *   ReturnValues: 'NONE'|'ALL_OLD',
   * }) -> Promise<{
   *   Attributes: {...},
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string
   *   }
   * }>
   * ```
   *
   * @description
   * Write an item to a DynamoDB table using DyanmoDB JSON.
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
  putItem(Item, options = {}) {
    return this.client.putItem({
      TableName: this.name,
      Item,
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'putItem'
      error.Item = Item
      throw error
    })
  }

  /**
   * @name putItemJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * table.putItemJSON(item JSONObject, options {
   *   ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *   ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *   ReturnValues: 'NONE'|'ALL_OLD',
   * }) -> Promise<{
   *   attributes: JSONObject,
   *   ConsumedCapacity: {
   *     CapacityUnits: number,
   *     TableName: string,
   *   },
   * }>
   * ```
   *
   * @description
   * Write an item to a DynamoDB table using JSON format.
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
  putItemJSON(item, options = {}) {
    return this.client.putItem({
      TableName: this.name,
      Item: map(item, Dynamo.AttributeValue),
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'putItemJSON'
      error.item = item
      throw error
    }).then(result => {
      if (result.Attributes) {
        result.attributes = map(result.Attributes, Dynamo.attributeValueToJSON)
        delete result.Attributes
      }
      return result
    })
  }

  /**
   * @name getItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.getItem(key DynamoDBJSONKey) -> Promise<{ Item: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Retrieve an item from a DynamoDB table using DynamoDB JSON format.
   *
   * ```javascript
   * const res = await userTable.getItem({ id: { S: '1' } })
   * console.log(res) // { Item: { id: { S: '1' }, name: { S: 'John' } } }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  getItem(Key) {
    return this.client.getItem({
      TableName: this.name,
      Key
    }).promise().then(result => {
      if (result.Item == null) {
        const error = new Error(`Item not found for ${JSON.stringify(Key)}`)
        error.tableName = this.name
        throw error
      }

      return result
    }).catch(error => {
      error.TableName = this.name
      error.method = 'getItem'
      error.Key = Key
      throw error
    })
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
   * table.getItemJSON(key JSONKey) -> Promise<{ item: JSONObject }>
   * ```
   *
   * @description
   * Retrieve an item from a DynamoDB table using JSON format.
   *
   * ```javascript
   * const user = await userTable.getItemJSON({ id: '1' })
   * console.log(user) // { id: '1', name: 'John' }
   * ```
   *
   * @note
   * [AWS DynamoDB getItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#getItem-property)
   */
  getItemJSON(key) {
    return this.client.getItem({
      TableName: this.name,
      Key: map(key, Dynamo.AttributeValue),
    }).promise().then(result => {
      if (result.Item == null) {
        const error = new Error(`Item not found for ${JSON.stringify(key)}`)
        error.tableName = this.name
        throw error
      }

      result.item = map(result.Item, Dynamo.attributeValueToJSON)
      delete result.Item
      return result
    }).catch(error => {
      error.TableName = this.name
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
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.updateItem(
   *   Key DynamoDBJSONKey,
   *   Updates DynamoDBJSONObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Update an item in a DynamoDB table using DynamoDB JSON format.
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
  updateItem(Key, Updates, options = {}) {
    const updates = map(Updates, Dynamo.attributeValueToJSON)

    return this.client.updateItem({
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
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'updateItem'
      error.Key = Key
      error.Updates = Updates
      throw error
    })
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
   * table.updateItemJSON(
   *   key JSONKey,
   *   updates JSONObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> Promise<{ attributes: JSONObject }>
   * ```
   *
   * @description
   * Update an item in a DynamoDB table. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.updateItemJSON({ id: '1' }, {
   *   name: 'George',
   *   height: 180,
   *   heightUnits: 'cm',
   * })
   * ```
   *
   * @note
   * [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
   */
  updateItemJSON(key, updates, options = {}) {
    return this.client.updateItem({
      TableName: this.name,
      Key: map(key, Dynamo.AttributeValue),

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
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'updateItemJSON'
      error.key = key
      error.updates = updates
      throw error
    }).then(result => {
      if (result.Attributes) {
        result.attributes = map(result.Attributes, Dynamo.attributeValueToJSON)
        delete result.Attributes
      }
      return result
    })
  }

  /**
   * @name incrementItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * type DynamoDBJSONIncrementObject = Object<{ N: number }>
   *
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.incrementItem(
   *   key DynamoDBJSONKey,
   *   incrementUpdates DynamoDBJSONIncrementObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Increment the attributes of an item in a DynamoDB table. Negative numbers will decrement the attribute of the item. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.incrementItem({ id: { S: '1' } }, { age: { N: 1 } })
   * ```
   */
  incrementItem(Key, IncrementUpdates, options = {}) {
    const incrementUpdates = map(IncrementUpdates, Dynamo.attributeValueToJSON)

    return this.client.updateItem({
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
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'incrementItem'
      error.Key = Key
      error.IncrementUpdates = IncrementUpdates
      throw error
    })
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
   * table.incrementItemJSON(
   *   key JSONKey,
   *   incrementUpdates JSONIncrementObject,
   *   options {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   }
   * ) -> Promise<{ attributes: JSONObject }>
   * ```
   *
   * @description
   * Increment the attributes of an item in a DynamoDB table. Negative numbers will decrement the attribute of the item. Accepts DynamoDB JSON and JSON formats.
   *
   * ```javascript
   * await userTable.incrementItemJSON({ id: '1' }, { age: 1 })
   * ```
   */
  incrementItemJSON(key, incrementUpdates, options = {}) {
    return this.client.updateItem({
      TableName: this.name,
      Key: Dynamo.isDynamoDBJSON(key) ? key : map(key, Dynamo.AttributeValue),

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
          Dynamo.AttributeValue(value),
        ]),

      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'incrementItemJSON'
      error.key = key
      error.incrementUpdates = incrementUpdates
      throw error
    }).then(result => {
      if (result.Attributes) {
        result.attributes = map(result.Attributes, Dynamo.attributeValueToJSON)
        delete result.Attributes
      }
      return result
    })
  }

  /**
   * @name deleteItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.deleteItem(
   *   key DynamoDBJSONKey,
   *   options {
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD',
   *   }
   * ) -> Promise<{ Attributes: DynamoDBJSONObject }>
   * ```
   *
   * @description
   * Delete an item from a DynamoDB table using DynamoDB JSON.
   *
   * ```javascript
   * await userTable.deleteItem({ id: { S: '1' } })
   * ```
   */
  deleteItem(Key, options) {
    return this.client.deleteItem({
      TableName: this.name,
      Key,
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'deleteItem'
      error.Key = Key
      throw error
    })
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
   * table.deleteItemJSON(
   *   key JSONKey,
   *   options {
   *     ReturnConsumedCapacity: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics: 'SIZE'|'NONE',
   *     ReturnValues: 'NONE'|'ALL_OLD',
   *   }
   * ) -> Promise<{ attributes: JSONObject }>
   * ```
   *
   * @description
   * Delete an item from a DynamoDB table using JSON format.
   *
   * ```javascript
   * await userTable.deleteItemJSON({ id: '1' })
   * ```
   */
  deleteItemJSON(key, options) {
    return this.client.deleteItem({
      TableName: this.name,
      Key: map(key, Dynamo.AttributeValue),
      ...options,
    }).promise().catch(error => {
      error.tableName = this.name
      error.method = 'deleteItemJSON'
      error.key = key
      throw error
    }).then(result => {
      if (result.Attributes) {
        result.attributes = map(result.Attributes, Dynamo.attributeValueToJSON)
        delete result.Attributes
      }
      return result
    })
  }

  /**
   * @name scan
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * table.scan(options {
   *   Limit: number,
   *   ExclusiveStartKey: DynamoDBJSONKey
   * }) -> Promise<{
   *   Items: Array<DynamoDBJSONObject>>
   *   Count: number,
   *   ScannedCount: number,
   *   LastEvaluatedKey: DynamoDBJSONKey
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
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * scanIterator(options {
   *   BatchLimit: number,
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
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * table.scanIteratorJSON(options {
   *   BatchLimit: number,
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
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * type DynamoDBJSONObject = Object<
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.query(
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
   * ) -> Promise<{ Items: Array<DynamoDBJSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB table using DynamoDB JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const response = await userVersionTable.query(
   *   'id = :id AND version > :version',
   *   { id: { S: '1' }, version: { N: '0' } },
   *   { ScanIndexForward: false },
   * )
   *
   * console.log(response)
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
   *   * `Limit` - Maximum number of items (hard limited by total size of response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   *   * `ConsistentRead` - true to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   */
  query(keyConditionExpression, Values, options = {}) {
    const values = map(Values, Dynamo.attributeValueToJSON)

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
   * @name queryJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoDBJSONKey = {
   *   [hashKey string]: { ['S'|'N'|'B']: string|number|Buffer },
   *   [sortKey string]: { ['S'|'N'|'B']: string|number|Buffer }
   * }
   *
   * type JSONArray = Array<string|number|Buffer|JSONArray|JSONObject>
   * type JSONObject = Object<string|number|Buffer|JSONArray|JSONObject>
   *
   * table.queryJSON(
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
   * ) -> Promise<{ items: Array<JSONObject> }>
   * ```
   *
   * @description
   * Query a DynamoDB table using JSON format.
   *
   * Use the hash and sort keys as query parameters and to construct the key condition expression. The key condition expression is a SQL-like query language comprised of the table's hashKey and sortKey, e.g. `myHashKey = :a AND mySortKey < :b`. Read more about [key condition expressions](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.KeyConditionExpressions.html).
   *
   * ```javascript
   * // userVersionTable has hashKey `id` and sortKey `version`
   *
   * const response = await userVersionTable.queryJSON(
   *   'id = :id AND version > :version',
   *   { id: '1', version: 0 },
   *   { ScanIndexForward: false },
   * )
   *
   * console.log(response)
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
   *   * `Limit` - Maximum number of items (hard limited by total size of response)
   *   * `ExclusiveStartKey` - Key after which to start reading
   *   * `ScanIndexForward` - true to sort items in ascending order
   *   * `ProjectionExpression` - list of attributes to be returned for each item in query result, e.g. `fieldA,fieldB,fieldC`
   *   * `FilterExpression` - filter queried results by this expression, e.g. `fieldA >= :someValue`
   *   * `ConsistentRead` - true to perform a strongly consistent read (eventually consistent by default). Consumes more RCUs.
   */
  queryJSON(keyConditionExpression, values, options = {}) {
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
    }).promise().then(result => {
      result.items = map(result.Items, map(Dynamo.attributeValueToJSON))
      delete result.Items
      return result
    })
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
   *   { 'S': string }
   *   |{ 'N': number }
   *   |{ 'B': Buffer }
   *   |{ 'L': Array<DynamoDBJSONObject> }
   *   |{ 'M': Object<DynamoDBJSONObject> }
   * >
   *
   * table.queryItemsIterator(
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
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB table in DynamoDB JSON format.
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
   * table.queryItemsIteratorJSON(
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
   * Get an `AsyncIterator` of all items represented by a query on a DynamoDB table in JSON format.
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
    yield* response.items
    numYielded += response.items.length

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
      yield* response.items
      numYielded += response.items.length
    }
  }
}

module.exports = DynamoDBTable
