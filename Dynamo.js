const pipe = require('rubico/pipe')
const fork = require('rubico/fork')
const map = require('rubico/map')
const get = require('rubico/get')
const curry = require('rubico/curry')
const DynamoDB = require('aws-sdk/clients/dynamodb')

const isArray = Array.isArray

const isBinary = ArrayBuffer.isView

const objectKeys = Object.keys

// { [key string]: any } => key
const getFirstKey = object => {
  for (const key in object) {
    return key
  }
}

// { [key string]: value any } => value
const getFirstValue = object => {
  for (const key in object) {
    return object[key]
  }
}

// message => ()
const throwTypeError = function throwTypeError(message) {
  throw new TypeError(message)
}

/**
 * @name Dynamo
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(dynamo string|DynamoDB|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }) -> DynamoTable
 * ```
 */
const Dynamo = function (dynamo) {
  if (typeof this == null || this.constructor != Dynamo) {
    return new Dynamo(dynamo)
  }
  if (typeof dynamo == 'string') {
    this.dynamodb = new DynamoDB({
      apiVersion: '2012-08-10',
      accessKeyId: 'accessKeyId-placeholder',
      secretAccessKey: 'secretAccessKey-placeholder',
      region: 'region-placeholder',
      endpoint: dynamo,
    })
  } else if (dynamo.constructor == DynamoDB) {
    this.dynamodb = dynamo
  } else {
    this.dynamodb = new DynamoDB({
      apiVersion: '2012-08-10',
      accessKeyId: 'accessKeyId-placeholder',
      secretAccessKey: 'secretAccessKey-placeholder',
      region: 'region-placeholder',
      ...dynamo,
    })
  }
}

/**
 * @name Dynamo.prototype.createTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo(dynamo).createTable(
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
 * Dynamo(dynamo).createTable('my-table', [{ id: 'string' }])
 *
 * Dynamo(dynamo).createTable('my-table', [{ id: 'string' }, { createTime: 'number' }])
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
  return this.dynamodb.createTable(params).promise()
}

/**
 * @name Dynamo.prototype.deleteTable
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo(dynamo).deleteTable(tablename string) -> Promise<DynamoResponse>
 * ```
 */
Dynamo.prototype.deleteTable = async function deleteTable(tablename) {
  return this.dynamodb.deleteTable({
    TableName: tablename,
  }).promise().catch(error => {
    if (error.name != 'ResourceNotFoundException') {
      throw error
    }
  })
}

/**
 * @name Dynamo.prototype.createIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo(dynamo).createIndex(
 *   tablename string, 
 *   index [Object<DynamoAttributeType>, Object<DynamoAttributeType>?],
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
 * @reference
 * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html#LSI.Creating
 * https://stackoverflow.com/questions/36493323/adding-new-local-secondary-index-to-an-existing-dynamodb-table
 */

Dynamo.prototype.createIndex = async function createIndex(tablename, index, options) {
  const params = {
    IndexName: Dynamo.Indexname(index),
    KeySchema: Dynamo.KeySchema(index),
    AttributeDefinitions: Dynamo.AttributeDefinitions(index),
    ...options,
  }

  if (params.BillingMode == 'PROVISIONED') {
    params.ProvisionedThroughput = get('ProvisionedThroughput', {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    })(options)
  }
  return this.dynamodb.updateTable({
    TableName: tablename,
    GlobalSecondaryIndexUpdates: [{ Create: params }],
  })
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
 *
 * @TODO
 * use single line inspect
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
