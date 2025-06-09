require('rubico/global')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const Dynamo = require('./Dynamo')
const hashJSON = require('./internal/hashJSON')
const stringifyJSON = require('./internal/stringifyJSON')
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
 * DynamoTable(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * })
 * ```
 *
 * @description
 * Creates a DynamoDB table. [aws-sdk DynamoDB](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)
 *
 * ```javascript
 * new DynamoTable({
 *   name: 'my-local-table',
 *   endpoint: 'http://localhost:8000/',
 * })
 *
 * new DynamoTable({
 *   name: my-aws-table',
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region',
 * }
 * ```
 */
const DynamoTable = function (options) {
  if (this == null || this.constructor != DynamoTable) {
    return new DynamoTable(options)
  }
  this.name = options.name
  this.key = options.key
  this.dynamo = new Dynamo(pick([
    'accessKeyId',
    'secretAccessKey',
    'region',
    'endpoint',
  ])(options))
  this.client = this.dynamo.connection
  this.ready = this.inspect().then(async () => {
    await this.dynamo.waitFor(this.name, 'tableExists')
  }).catch(async () => {
    await this.dynamo.createTable(this.name, options.key)
    await this.dynamo.waitFor(this.name, 'tableExists')
  })
  return this
}

/**
 * @name DynamoTable.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).inspect() -> Promise<Object>
 * ```
 */
DynamoTable.prototype.inspect = function dynamoTableInspect() {
  return this.dynamo.describeTable(this.name)
}

/**
 * @name DynamoTable.prototype.delete
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).delete() -> Promise<Object>
 * ```
 */
DynamoTable.prototype.delete = async function dynamoTableDelete() {
  await this.dynamo.deleteTable(this.name)
  return this.dynamo.waitFor(this.name, 'tableNotExists')
}

/**
 * @name DynamoTable.prototype.putItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).putItem(
 *   item Object,
 *   options? {
 *     returnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     returnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     returnValues?: 'NONE'|'ALL_OLD',
 *   }, // TODO finish these options
 * )
 * ```
 *
 * @description
 * `AWS.DynamoDB.prototype.putItem` for JavaScript Objects. [aws-sdk DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
 *
 * ```javascript
 * const localUsersTable = DynamoTable('http://localhost:8000/', 'my-local-table')
 *
 * const localUsersTable = DynamoTable({
 *   name: 'my-local-table',
 *   endpoint: 'http://localhost:8000/',
 * })
 *
 * await localUsersTable.ready
 *
 * await localUsersTable.putItem({ _id: '1', name: 'Geor' })
 * ```
 */
DynamoTable.prototype.putItem = async function dynamoTablePutItem(item, options) {
  await this.ready
  return this.client.putItem({
    TableName: this.name,
    Item: map(Dynamo.AttributeValue)(item),
    ...options,
  }).promise().catch(error => {
    error.tableName = this.name
    error.method = 'putItem'
    error.item = item
    throw error
  })
}

/**
 * @name DynamoTable.prototype.getItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).getItem(key Object) -> Promise<{ Item: DynamoAttributeValue }>
 * ```
 */
DynamoTable.prototype.getItem = async function dynamoTableGetItem(key) {
  await this.ready
  return this.client.getItem({
    TableName: this.name,
    Key: map(Dynamo.AttributeValue)(key),
  }).promise().then(result => {
    if (result.Item == null) {
      const error = new Error(`Item not found for ${stringifyJSON(key)}`)
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
 * @name DynamoTable.prototype.updateItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).updateItem(
 *   key Object,
 *   updates Object,
 *   options? {
 *     ConditionExpression: string, // 'attribute_exists(username)'
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
 *   },
 * ) -> Promise<{ Attributes?: object }>
 * ```
 *
 * @description
 * `AWS.DynamoDB.prototype.updateItem` for JavaScript Objects. [aws-sdk DynamoDB updateItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#updateItem-property)
 *
 * ```javascript
 * const localUsersTable = DynamoTable({
 *   name: 'my-local-table',
 *   endpoint: 'http://localhost:8000/',
 * })
 *
 * await localUsersTable.ready
 *
 * await localUsersTable.updateItem({ _id: '1' }, {
 *   name: 'George',
 *   height: 180,
 *   heightUnits: 'cm',
 * })
 * ```
 */
DynamoTable.prototype.updateItem = async function dynamoTableUpdateItem(
  key, updates, options,
) {
  await this.ready
  return this.client.updateItem({
    TableName: this.name,
    Key: map(Dynamo.AttributeValue)(key),
    UpdateExpression: pipe([
      Object.entries,
      map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
      join(', '),
      expression => `set ${expression}`,
    ])(updates),
    ExpressionAttributeNames: map.entries(
      ([key, value]) => [`#${hashJSON(key)}`, key],
    )(updates),
    ExpressionAttributeValues: map.entries(
      ([key, value]) => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)],
    )(updates),
    ...options,
  }).promise().catch(error => {
    error.tableName = this.name
    error.method = 'updateItem'
    error.key = key
    error.updates = updates
    throw error
  })
}

/**
 * @name DynamoTable.prototype.incrementItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable.prototype.incrementItem(
 *   key Object,
 *   incrementUpdates Object,
 *   options? {
 *     ConditionExpression: string, // 'attribute_exists(username)'
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
 *   },
 * ) -> Promise<{ Attributes?: object }>
 * ```
 */
DynamoTable.prototype.incrementItem = async function incrementItem(
  key, incrementUpdates, options,
) {
  await this.ready
  return this.client.updateItem({
    TableName: this.name,
    Key: map(Dynamo.AttributeValue)(key),
    UpdateExpression: pipe([
      Object.entries,
      map(([key, value]) => `#${hashJSON(key)} :${hashJSON(value)}`),
      join(', '),
      expression => `add ${expression}`,
    ])(incrementUpdates),
    ExpressionAttributeNames: map.entries(
      ([key, value]) => [`#${hashJSON(key)}`, key],
    )(incrementUpdates),
    ExpressionAttributeValues: map.entries(
      ([key, value]) => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)],
    )(incrementUpdates),
    ...options,
  }).promise().catch(error => {
    error.tableName = this.name
    error.method = 'incrementItem'
    error.key = key
    error.incrementUpdates = incrementUpdates
    throw error
  })
}

/**
 * @name DynamoTable.prototype.deleteItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).deleteItem(
 *   key Object,
 *   options? {
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD',
 *   },
 * ) -> Promise<{ Item: Object<DynamoAttributeValue> }>
 * ```
 */
DynamoTable.prototype.deleteItem = async function dynamoTableDeleteItem(key, options) {
  await this.ready
  return this.client.deleteItem({
    TableName: this.name,
    Key: map(Dynamo.AttributeValue)(key),
    ...options,
  }).promise().catch(error => {
    error.tableName = this.name
    error.method = 'deleteItem'
    error.key = key
    throw error
  })
}

/**
 * @name DynamoTable.prototype.scan
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).scan(options {
 *   limit: number,
 *   exclusiveStartKey: Object<string=>DynamoAttributeValue>
 *   forceTableName?: string, // a test parameter
 * }) -> Promise<{
 *   Items: Array<Object<string=>DynamoAttributeValue>>
 *   Count: number, // number of Items
 *   ScannedCount: number, // number of items evaluated before scanFilter is applied
 *   LastEvaluatedKey: Object<string=>DynamoAttributeValue>,
 * }>
 * ```
 */
DynamoTable.prototype.scan = async function scan(options = {}) {
  await this.ready
  return this.client.scan({
    TableName: this.name,
    Limit: options.limit ?? 100,
    ...options.exclusiveStartKey && {
      ExclusiveStartKey: options.exclusiveStartKey,
    },
  }).promise().catch(error => {
    error.tableName = this.name
    error.method = 'scan'
    throw error
  })
}

/**
 * @name DynamoTable.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DynamoTable(...).query(
 *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
 *   values {
 *     [hashKey]: string|number|Buffer|TypedArray,
 *     [sortKey]: string|number|Buffer|TypedArray,
 *   },
 *   options? {
 *     limit: number,
 *     exclusiveStartKey: Object<string=>DynamoAttributeValue>
 *     scanIndexForward: boolean, // default true for ASC
 *     projectionExpression: string, // 'fieldA,fieldB,fieldC'
 *     filterExpression: string, // 'fieldA >= :someValueForFieldA'
 *     select: 'ALL_ATTRIBUTES'|'ALL_PROJECTED_ATTRIBUTES'|'COUNT'|'SPECIFIC_ATTRIBUTES',
 *     consistentRead: boolean, // true to perform a strongly consistent read (eventually consistent by default)
 *   },
 * ) -> Promise<{ Items: Array<Object> }>
 * ```
 *
 * @description
 * Note: only works for tables with a sort and hash key
 */
DynamoTable.prototype.query = async function query(
  keyConditionExpression, values, options = {}
) {
  await this.ready
  const keyConditionStatements = keyConditionExpression.trim().split(/\s+AND\s+/)
  let statementsIndex = -1
  while (++statementsIndex < keyConditionStatements.length) {
    if (keyConditionStatements[statementsIndex].includes('BETWEEN')) {
      keyConditionStatements[statementsIndex] +=
        ` AND ${keyConditionStatements.splice(statementsIndex + 1, 1)}`
    }
  }

  const filterExpressionStatements =
    options.filterExpression == null ? []
    : options.filterExpression.trim().split(/\s+AND\s+/)
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
    ...filterExpressionStatements.length > 0 && { FilterExpression },

    ...options.limit && { Limit: options.limit },
    ...options.exclusiveStartKey && {
      ExclusiveStartKey: options.exclusiveStartKey,
    },
    ...options.scanIndexForward != null && {
      ScanIndexForward: options.scanIndexForward
    },
    ...options.projectionExpression && {
      ProjectionExpression: options.projectionExpression
        .split(',').map(field => `#${hashJSON(field)}`).join(','),
    },
  }).promise()
}

module.exports = DynamoTable
