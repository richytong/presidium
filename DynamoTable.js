const rubico = require('rubico')
const rubicoX = require('rubico/x')
const crypto = require('crypto')
const DynamoDB = require('aws-sdk/clients/dynamodb')
const Dynamo = require('./Dynamo')
const isPromise = require('./internal/isPromise')
const hashJSON = require('./internal/hashJSON')

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
} = rubicoX

const stringifyJSON = JSON.stringify

const arrayPush = (array, item) => array.push(item)

const join = delimiter => value => value.join(delimiter)

const objectSet = (object, key, value) => {
  object[key] = value
  return object
}

const objectSetEntry = (object, entry) => {
  object[entry[0]] = entry[1]
  return object
}

const objectMapKeys = function (object, mapper) {
  const result = {},
    promises = []
  for (const key in object) {
    const mappedKey = mapper(key),
      value = object[key]
    if (isPromise(mappedKey)) {
      promises.push(mappedKey.then(curry(objectSet, result, __, value)))
    } else {
      result[mappedKey] = value
    }
  }
  return promises.length == 0 ? result
    : Promise.all(promises).then(always(result))
}

map.keys = mapper => object => objectMapKeys(object, mapper)

const objectMapEntries = function (object, mapper) {
  const result = {},
    promises = []
  for (const key in object) {
    const value = object[key],
      mappedEntry = mapper([key, value])
    if (isPromise(mappedEntry)) {
      promises.push(mappedEntry.then(curry(objectSetEntry, result, __)))
    } else {
      result[mappedEntry[0]] = mappedEntry[1]
    }
  }
  return promises.length == 0 ? result
    : Promise.all(promises).then(always(result))
}

map.entries = mapper => object => objectMapEntries(object, mapper)

transform.entries = (transducer, init) => object => transform(transducer, init)(Object.entries(object))

/**
 * @name DynamoTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(dynamo string|DynamoDB|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }, tablename string) -> DynamoTable
 * ```
 *
 * @description
 * Creates a DynamoDB table. [aws-sdk DynamoDB](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html)
 *
 * ```javascript
 * DynamoTable('http://localhost:8000/', 'my-local-table') // -> DynamoTable
 *
 * DynamoTable({
 *   accessKeyId: 'my-access-key-id',
 *   secretAccessKey: 'my-secret-access-key',
 *   region: 'my-region',
 * }, 'my-aws-table') // -> DynamoTable
 * ```
 */
const DynamoTable = function (dynamo, tablename) {
  if (typeof this == null || this.constructor != DynamoTable) {
    return new DynamoTable(dynamo, tablename)
  }
  this.dynamodb = new Dynamo(dynamo).dynamodb
  this.tablename = tablename
}

/**
 * @name DynamoTable.prototype.putItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(dynamo string|object, tablename string).putItem(
 *   item Object,
 *   options? {
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD',
 *   },
 * )
 * ```
 *
 * @description
 * `AWS.DynamoDB.prototype.putItem` for JavaScript Objects. [aws-sdk DynamoDB putItem](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#putItem-property)
 *
 * ```javascript
 * const localUsersTable = DynamoTable('http://localhost:8000/', 'my-local-table')
 *
 * await localUsersTable.ready
 *
 * await localUsersTable.putItem({ _id: '1', name: 'Geor' })
 * ```
 */
DynamoTable.prototype.putItem = function putItem(item, options) {
  return this.dynamodb.putItem({
    TableName: this.tablename,
    Item: map(Dynamo.AttributeValue)(item),
    ...options,
  }).promise()
}

/**
 * @name DynamoTable.prototype.getItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(dynamo).getItem(key Object) -> Promise<{ Item: DynamoAttributeValue }>
 * ```
 */
DynamoTable.prototype.getItem = function getItem(key) {
  return this.dynamodb.getItem({
    TableName: this.tablename,
    Key: map(Dynamo.AttributeValue)(key),
  }).promise().then(tap(result => {
    if (result.Item == null) {
      throw new Error(`Item not found for ${stringifyJSON(key)}`)
    }
  }))
}

/**
 * @name DynamoTable.prototype.updateItem
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoTable(dynamo string|object, tablename string).updateItem(
 *   key Object,
 *   updates Object,
 *   options? {
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
 * const localUsersTable = DynamoTable('http://localhost:8000/', 'my-local-table')
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
DynamoTable.prototype.updateItem = function updateItem(key, updates, options) {
  return this.dynamodb.updateItem({
    TableName: this.tablename,
    Key: map(Dynamo.AttributeValue)(key),
    UpdateExpression: pipe([
      transform.entries(
        map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
        () => []),
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
 * DynamoTable(dynamo).deleteItem(
 *   key Object,
 *   options? {
 *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
 *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
 *     ReturnValues?: 'NONE'|'ALL_OLD',
 *   },
 * ) -> Promise<{ Item: Object<DynamoAttributeValue> }>
 * ```
 */
DynamoTable.prototype.deleteItem = function deleteItem(key, options) {
  return this.dynamodb.deleteItem({
    TableName: this.tablename,
    Key: map(Dynamo.AttributeValue)(key),
    ...options,
  }).promise()
}

module.exports = DynamoTable
