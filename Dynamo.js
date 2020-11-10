const pipe = require('rubico/pipe')
const fork = require('rubico/fork')
const map = require('rubico/map')
const get = require('rubico/get')
const curry = require('rubico/curry')
const DynamoDB = require('aws-sdk/clients/dynamodb')

const isArray = Array.isArray

const isBinary = ArrayBuffer.isView

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
    this.dynamo = new DynamoDB({
      apiVersion: '2012-08-10',
      accessKeyId: 'accessKeyId-placeholder',
      secretAccessKey: 'secretAccessKey-placeholder',
      region: 'region-placeholder',
      endpoint: dynamo,
    })
  } else if (dynamo.constructor == DynamoDB) {
    this.dynamo = dynamo
  } else {
    this.dynamo = new DynamoDB({
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
 * AttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
 *
 * Dynamo(dynamo).createTable(
 *   tablename string, 
 *   primaryKey Array<Object<AttributeType>>,
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
 * AttributeType
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
    KeySchema: primaryKey.length == 1 ? [{
      AttributeName: getFirstKey(primaryKey[0]),
      KeyType: 'HASH',
    }] : [{
      AttributeName: getFirstKey(primaryKey[0]),
      KeyType: 'HASH',
    }, {
      AttributeName: getFirstKey(primaryKey[1]),
      KeyType: 'RANGE',
    }],
    AttributeDefinitions: primaryKey.map(curry.arity(1, fork({
      AttributeName: getFirstKey,
      AttributeType: pipe([
        getFirstValue,
        Dynamo.toAttributeType,
      ]),
    }))),
    BillingMode: get('BillingMode', 'PROVISIONED')(options),
  }
  if (params.BillingMode == 'PROVISIONED') {
    params.ProvisionedThroughput = get('ProvisionedThroughput', {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    })(options)
  }
  return this.dynamo.createTable(params).promise()
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
  return this.dynamo.deleteTable({
    TableName: tablename,
  }).promise().catch(error => {
    if (error.name != 'ResourceNotFoundException') {
      throw error
    }
  })
}

/**
 * @name Dynamo.toAttributeType
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Dynamo.toAttributeType(value string) -> 'S'
 *
 * Dynamo.toAttributeType(value number) -> 'N'
 *
 * Dynamo.toAttributeType(value TypedArray) -> 'B'
 * ```
 *
 * @TODO
 * use single line inspect
 */
Dynamo.toAttributeType = function toAttributeType(value) {
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
 * @name Dynamo.toAttributeValue
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
 * Dynamo.toAttributeValue(value any) -> DynamoAttributeValue
 * ```
 */
Dynamo.toAttributeValue = function toAttributeValue(value) {
  return isArray(value) ? { L: value.map(toAttributeValue) }
    : typeof value == 'string' ? { S: value }
    : typeof value == 'number' && !isNaN(value) ? { N: value.toString(10) }
    : typeof value == 'boolean' ? { BOOL: value }
    : value == null ? { NULL: true }
    : value.constructor == Object ? { M: map.own(toAttributeValue)(value) }
    : throwTypeError(`unknown value ${value}`)
}

/**
 * @name Dynamo.fromAttributeValue
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
 * Dynamo.fromAttributeValue(value DynamoAttributeValue) -> string|number|boolean|Array|Object
 * ```
 */
Dynamo.fromAttributeValue = function fromAttributeValue(value) {
  switch (getFirstKey(value)) {
    case 'S':
      return String(value.S)
    case 'N':
      return Number(value.N)
    case 'BOOL':
      return Boolean(value.BOOL)
    case 'NULL':
      return null
    case 'L':
      return value.L.map(fromAttributeValue)
    case 'M':
      return map.own(fromAttributeValue)(value.M)
    default:
      throw new TypeError(`unknown value ${value}`)
  }
}

module.exports = Dynamo
