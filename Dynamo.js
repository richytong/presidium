const pipe = require('rubico/pipe')
const fork = require('rubico/fork')
const map = require('rubico/map')
const get = require('rubico/get')
const curry = require('rubico/curry')
const noop = require('rubico/x/noop')
const defaultsDeep = require('rubico/x/defaultsDeep')
const AWSDynamo = require('aws-sdk/clients/dynamodb')
const getFirstKey = require('./internal/getFirstKey')
const getFirstValue = require('./internal/getFirstValue')
const HttpAgent = require('./HttpAgent')

const isArray = Array.isArray

const isBinary = ArrayBuffer.isView

const objectKeys = Object.keys

// message => ()
const throwTypeError = function throwTypeError(message) {
  throw new TypeError(message)
}

/**
 * @name Dynamo
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> DynamoTable
 *
 * Dynamo(endpoint string) -> DynamoTable
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property
 */
const Dynamo = function (options) {
  if (this == null || this.constructor != Dynamo) {
    return new Dynamo(options)
  }
  this.connection = new AWSDynamo({
    apiVersion: '2012-08-10',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    region: 'x-x-x',
    ...options,
  })
  return this
}

/**
 * @name Dynamo.prototype.describeTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(options).describeTable(tablename string) -> Promise<Object>
 * ```
 */
Dynamo.prototype.describeTable = function (tablename) {
  return this.connection.describeTable({ TableName: tablename }).promise()
}

/**
 * @name Dynamo.prototype.enableStreams
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(options).enableStreams(
 *   tablename string,
 *   options {
 *     streamViewType: 'NEW_IMAGE'|'OLD_IMAGE'|'NEW_AND_OLD_IMAGES'|'KEYS_ONLY',
 *   },
 * ) -> Promise<Object>
 * ```
 */
Dynamo.prototype.enableStreams = function (tablename, options) {
  return this.connection.updateTable({
    TableName: tablename,
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: options.streamViewType,
    },
  }).promise()
}

/**
 * @name Dynamo.prototype.createTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo(options).createTable(
 *   tablename string,
 *   primaryKey [Object<DynamoAttributeType>, Object<DynamoAttributeType>?],
 *   options? {
 *     ProvisionedThroughput?: {
 *       ReadCapacityUnits: number,
 *       WriteCapacityUnits: number,
 *     },
 *     BillingMode?: 'PROVISIONED'|'PAY_PER_REQUEST',
 *   },
 * )
 * ```
 *
 * @description
 * Creates a DynamoDB table.
 *
 * DynamoAttributeType
 *  * `'S'` - string
 *  * `'N'` - number
 *  * `'B'` - binary
 *
 * ```javascript
 * Dynamo(options).createTable('my-table', [{ id: 'string' }])
 *
 * Dynamo(options).createTable('my-table', [{ id: 'string' }, { createTime: 'number' }])
 * ```
 */
Dynamo.prototype.createTable = function createTable(
  tablename, primaryKey, options,
) {
  const params = {
    TableName: tablename,
    KeySchema: Dynamo.KeySchema(primaryKey),
    AttributeDefinitions: Dynamo.AttributeDefinitions(primaryKey),
    BillingMode: get('BillingMode', 'PROVISIONED')(options),
  }
  if (params.BillingMode == 'PROVISIONED') {
    params.ProvisionedThroughput = get('ProvisionedThroughput', {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    })(options)
  }
  return this.connection.createTable(params).promise()
}

/**
 * @name Dynamo.prototype.deleteTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(options).deleteTable(tablename string) -> Promise<DynamoResponse>
 * ```
 */
Dynamo.prototype.deleteTable = async function deleteTable(tablename) {
  return this.connection.deleteTable({
    TableName: tablename,
  }).promise().catch(noop)
}

/**
 * @name Dynamo.prototype.waitFor
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(options).waitFor(
 *   tablename string,
 *   status 'tableExists'|'tableNotExists',
 * ) -> Promise<{
 *   AttributeDefinitions: Array<{ AttributeName: string, AttributeType: any }>,
 *   TableName: string,
 *   KeySchema: Array<{ AttributeName: string, KeyType: 'HASH'|'RANGE' }>,
 *   TableStatus: 'CREATING'|'UPDATING'|'DELETING'|'ACTIVE'|'INACCESSIBLE_ENCRYPTION_CREDENTIALS'|'ARCHIVING'|'ARCHIVED'
 *   CreationDateTime: Date,
 *   ProvisionedThroughput: {
 *     LastIncreaseDateTime: Date,
 *     LastDecreaseDateTime: Date,
 *     NumberOfDecreasesToday: number,
 *     ReadCapacityUnits: number,
 *     WriteCapacityUnits: number,
 *   },
 *   TableSizeBytes: number,
 *   ItemCount: number, // The number of items in the specified table. DynamoDB updates this value approximately every six hours. Recent changes might not be reflected in this value.
 *   TableArn: string,
 *   TableId: string,
 *   BillingModeSummary: {
 *     BillingMode: 'PROVISIONED'|'PAY_PER_REQUEST',
 *     LocalSecondaryIndexes: Array<Object>,
 *     GlobalSecondaryIndexes: Array<Object>,
 * }>
 * ```
 *
 * @description
 * Wait for a Dynamo Table
 *
 * ```javascript
 * Dynamo('http://localhost:8000/')
 *   .waitFor('test-tablename', 'tableExists')
 *   .then(console.log)
 * // {
 * //   Table: {
 * //     AttributeDefinitions: [ [Object] ],
 * //     TableName: 'test-tablename',
 * //     KeySchema: [ [Object] ],
 * //     TableStatus: 'ACTIVE',
 * //     CreationDateTime: 2020-11-13T22:29:35.269Z,
 * //     ProvisionedThroughput: {
 * //       LastIncreaseDateTime: 1970-01-01T00:00:00.000Z,
 * //       LastDecreaseDateTime: 1970-01-01T00:00:00.000Z,
 * //       NumberOfDecreasesToday: 0,
 * //       ReadCapacityUnits: 5,
 * //       WriteCapacityUnits: 5
 * //     },
 * //     TableSizeBytes: 0,
 * //     ItemCount: 0,
 * //     TableArn: 'arn:aws:dynamodb:ddblocal:000000000000:table/test-tablename'
 * //   }
 * // }
 * ```
 */
Dynamo.prototype.waitFor = async function waitFor(tablename, status) {
  return this.connection.waitFor(status, {
    TableName: tablename,
  }).promise()
}

/**
 * @name Dynamo.prototype.createIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo(options).createIndex(
 *   tablename string,
 *   index [Object<DynamoAttributeType>, Object<DynamoAttributeType>?],
 *   options? {
 *     ProvisionedThroughput?: {
 *       ReadCapacityUnits: number,
 *       WriteCapacityUnits: number,
 *     },
 *     Projection?: {
 *       NonKeyAttributes?: Array<string>,
 *       ProjectionType: 'ALL'|'KEYS_ONLY'|'INCLUDE',
 *     }
 *   },
 * )
 * ```
 *
 * @description
 * ```javascript
 * Dynamo('localhost:8000').createIndex('test-tablename', [{ status: 'string', createTime: 'number' }])
 * ```
 *
 * @reference
 * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html#LSI.Creating
 * https://stackoverflow.com/questions/36493323/adding-new-local-secondary-index-to-an-existing-dynamodb-table
 */

Dynamo.prototype.createIndex = async function createIndex(tablename, index, options = {}) {
  const params = {
    IndexName: Dynamo.Indexname(index),
    KeySchema: Dynamo.KeySchema(index),
    ...defaultsDeep({
      Projection: {
        ProjectionType: 'ALL',
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    })(options),
  }

  return this.connection.updateTable({
    TableName: tablename,
    AttributeDefinitions: Dynamo.AttributeDefinitions(index),
    GlobalSecondaryIndexUpdates: [{ Create: params }],
  }).promise()
}

/**
 * @name Dynamo.KeySchema
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo.KeySchema(
 *   primaryKeyOrIndex [{ string: DynamoAttributeType }],
 * ) -> [{ AttributeName: string, KeyType: 'HASH' }]
 *
 * Dynamo.KeySchema(
 *   primaryKeyOrIndex [{ string: DynamoAttributeType }, { string: DynamoAttributeType }],
 * ) -> [{ AttributeName: string, KeyType: 'HASH' }, { AttributeName: string, KeyType: 'RANGE' }]
 * ```
 */
Dynamo.KeySchema = function DynamoKeySchema(primaryKeyOrIndex) {
  return primaryKeyOrIndex.length == 1 ? [{
    AttributeName: getFirstKey(primaryKeyOrIndex[0]),
    KeyType: 'HASH',
  }] : [{
    AttributeName: getFirstKey(primaryKeyOrIndex[0]),
    KeyType: 'HASH',
  }, {
    AttributeName: getFirstKey(primaryKeyOrIndex[1]),
    KeyType: 'RANGE',
  }]
}

/**
 * @name Dynamo.AttributeDefinitions
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo.AttributeDefinitions(
 *   primaryKeyOrIndex Array<Object<DynamoAttributeType>>
 * ) -> Array<{ AttributeName: string, AttributeType: any }>
 * ```
 */
Dynamo.AttributeDefinitions = function DynamoAttributeDefinitions(primaryKeyOrIndex) {
  return primaryKeyOrIndex.map(fork({
    AttributeName: getFirstKey,
    AttributeType: pipe([
      getFirstValue,
      Dynamo.AttributeType,
    ]),
  }))
}

/**
 * @name Dynamo.Indexname
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo.Indexname(index [Object, Object?]) -> indexName string
 * ```
 *
 * @description
 * Converts an index object to its indexname
 *
 * ```javascript
 * console.log(
 *   Dynamo.Indexname([{ name: 'string' }, { createTime: 'number' }]),
 * ) // 'name-createTime-index'
 * ```
 */
Dynamo.Indexname = function DynamoIndexname(index) {
  return `${index.map(getFirstKey).join('-')}-index`
}

/**
 * @name Dynamo.AttributeType
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo.AttributeType(value string) -> 'S'
 *
 * Dynamo.AttributeType(value number) -> 'N'
 *
 * Dynamo.AttributeType(value TypedArray) -> 'B'
 * ```
 */
Dynamo.AttributeType = function DynamoAttributeType(value) {
  switch (value) {
    case 'string':
    case 'S':
      return 'S'
    case 'number':
    case 'N':
      return 'N'
    case 'binary':
    case 'B':
      return 'B'
    default:
      throw new TypeError(`unknown type for ${value}`)
  }
}

/**
 * @name Dynamo.AttributeValue
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeValue = {
 *   S: string,
 *   N: string,
 *   BOOL: boolean,
 *   NULL: boolean,
 *   L: Array<DynamoAttributeValue>,
 *   M: Object<DynamoAttributeValue>,
 * }
 *
 * Dynamo.AttributeValue(value any) -> DynamoAttributeValue
 * ```
 */
Dynamo.AttributeValue = function DynamoAttributeValue(value) {
  return isArray(value) ? { L: value.map(DynamoAttributeValue) }
    : typeof value == 'string' ? { S: value }
    : typeof value == 'number' && !isNaN(value) ? { N: value.toString(10) }
    : typeof value == 'boolean' ? { BOOL: value }
    : value == null ? { NULL: true }
    : value.constructor == Object ? { M: map.own(DynamoAttributeValue)(value) }
    : throwTypeError(`unknown value ${value}`)
}

/**
 * @name Dynamo.attributeValueToJSON
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeValue = {
 *   S: string,
 *   N: string,
 *   BOOL: boolean,
 *   NULL: boolean,
 *   L: Array<DynamoAttributeValue>,
 *   M: Object<DynamoAttributeValue>,
 * }
 *
 * Dynamo.AttributeValue.toJSON(value DynamoAttributeValue) -> string|number|boolean|Array|Object
 * ```
 */
Dynamo.attributeValueToJSON = function attributeValueToJSON(attributeValue) {
  switch (getFirstKey(attributeValue)) {
    case 'S':
      return String(attributeValue.S)
    case 'N':
      return Number(attributeValue.N)
    case 'BOOL':
      return Boolean(attributeValue.BOOL)
    case 'NULL':
      return null
    case 'L':
      return attributeValue.L.map(attributeValueToJSON)
    case 'M':
      return map.own(attributeValueToJSON)(attributeValue.M)
    default:
      throw new TypeError(`unknown attributeValue ${attributeValue}`)
  }
}

module.exports = Dynamo
