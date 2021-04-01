const rubico = require('rubico')
const rubicoX = require('rubico/x')
const crypto = require('crypto')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const Dynamo = require('./Dynamo')
const isPromise = require('./internal/isPromise')
const hashJSON = require('./internal/hashJSON')
const stringifyJSON = require('./internal/stringifyJSON')
const join = require('./internal/join')
const has = require('./internal/has')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

const {
  values,
  noop,
} = rubicoX

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
 * DynamoTable({
 *   name: 'my-local-table',
 *   endpoint: 'http://localhost:8000/',
 * })
 *
 * DynamoTable({
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
  }).promise()
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
      throw new Error(`Item not found for ${stringifyJSON(key)}`)
    }
    return result
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
 * )
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
      map(([key, value]) => [`#${hashJSON(key)} = :${hashJSON(value)}`]),
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
  }).promise()
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
  }).promise()
}

/**
 * @name DynamoTable.prototype.scan
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(options).scan(options {
 *   limit: number,
 *   exclusiveStartKey: Object<string=>DynamoAttributeValue>
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
  }).promise()
}

module.exports = DynamoTable
