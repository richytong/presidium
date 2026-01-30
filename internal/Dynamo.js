require('rubico/global')
const { defaultsDeep } = require('rubico/x')
const DynamoDBClient = require('aws-sdk/clients/dynamodb')
require('aws-sdk/lib/maintenance_mode_message').suppress = true
const getFirstKey = require('./getFirstKey')
const getFirstValue = require('./getFirstValue')

/**
 * @name Dynamo
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Dynamo(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> dynamo Dynamo
 * ```
 *
 * @reference
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#constructor-property
 */
class Dynamo {
  constructor(options) {
    this.client = new DynamoDBClient({
      ...options,
      apiVersion: '2012-08-10',
    })
  }

  /**
   * @name KeySchema
   * @static
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
   *
   * KeySchema(
   *   primaryKeyOrIndex [{ string: DynamoAttributeType }]
   * ) -> [{ AttributeName: string, KeyType: 'HASH' }]
   *
   * KeySchema(
   *   primaryKeyOrIndex [
   *     { string: DynamoAttributeType },
   *     { string: DynamoAttributeType }
   *   ]
   * ) -> [
   *   { AttributeName: string, KeyType: 'HASH' },
   *   { AttributeName: string, KeyType: 'RANGE' }
   * ]
   * ```
   */
  static KeySchema(primaryKeyOrIndex) {
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
   * @name AttributeDefinitions
   * @static
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
   *
   * AttributeDefinitions(
   *   primaryKeyOrIndex Array<Object<DynamoAttributeType>>
   * ) -> Array<{ AttributeName: string, AttributeType: any }>
   * ```
   */
  static AttributeDefinitions(primaryKeyOrIndex) {
    return primaryKeyOrIndex.map(all({
      AttributeName: getFirstKey,
      AttributeType: pipe([
        getFirstValue,
        Dynamo.AttributeType,
      ]),
    }))
  }

  /**
   * @name AttributeDefinitions
   * @static
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
   *
   * AttributeDefinitions(
   *   primaryKeyOrIndex Array<Object<DynamoAttributeType>>
   * ) -> Array<{ AttributeName: string, AttributeType: any }>
   * ```
   */
  static AttributeDefinitions(primaryKeyOrIndex) {
    return primaryKeyOrIndex.map(all({
      AttributeName: getFirstKey,
      AttributeType: pipe([
        getFirstValue,
        Dynamo.AttributeType,
      ]),
    }))
  }

  /**
   * @name Indexname
   * @static
   *
   * @synopsis
   * ```coffeescript [specscript]
   * type JSONKey = {
   *   [hashKey string]: string|number|binary,
   *   [sortKey string]?: string|number|binary,
   * }
   *
   * Indexname(indexKey JSONKey) -> indexName string
   * ```
   *
   * @description
   * Converts an index key to its indexname
   *
   * ```javascript
   * console.log(
   *   Dynamo.Indexname([{ name: 'string' }, { createTime: 'number' }]),
   * ) // 'name-createTime-index'
   * ```
   */
  static Indexname(indexKey) {
    return `${indexKey.map(getFirstKey).join('-')}-index`
  }

  /**
   * @name AttributeType
   *
   * @synopsis
   * ```coffeescript [specscript]
   * AttributeType(value string) -> 'S'
   *
   * AttributeType(value number) -> 'N'
   *
   * AttributeType(value TypedArray) -> 'B'
   * ```
   */
  static AttributeType(value) {
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
        throw new TypeError(`Invalid value ${value}`)
    }
  }

  /**
   * @name AttributeValue
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
   * AttributeValue(value any) -> DynamoAttributeValue
   * ```
   */
  static AttributeValue(value) {
    if (Array.isArray(value)) {
      return { L: value.map(Dynamo.AttributeValue) }
    }
    if (typeof value == 'string') {
      return { S: value }
    }
    if (typeof value == 'number' && !isNaN(value)) {
      return { N: value.toString(10) }
    }
    if (typeof value == 'boolean') {
      return { BOOL: value }
    }
    if (value == null) {
      return { NULL: true }
    }
    if (value.constructor == Object) {
      return { M: map(value, Dynamo.AttributeValue) }
    }
    throw new TypeError(`Invalid value ${value}`)
  }

  /**
   * @name isDynamoDBJSON
   *
   * @synopsis
   * ```coffeescript [specscript]
   * isDynamoDBJSON(o object) -> boolean
   * ```
   */
  static isDynamoDBJSON(o) {
    if (typeof o != 'object') {
      return false
    }
    for (const key in o) {
      const value = o[key]
      if (Dynamo.isAttributeValue(value)) {
        continue
      }
      return false
    }
    return true
  }

  /**
   * @name isAttributeValue
   *
   * @synopsis
   * ```coffeescript [specscript]
   * isAttributeValue(o object) -> boolean
   * ```
   */
  static isAttributeValue(o) {
    if (typeof o != 'object') {
      return false
    }
    return (
      'S' in o
      || 'N' in o
      || 'B' in o
      || 'BOOL' in o
      || 'NULL' in o
      || 'M' in o
    )
  }

  /**
   * @name attributeValueToJSON
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
   * attributeValueToJSON(attributeValue DynamoAttributeValue) -> string|number|boolean|Array|Object
   * ```
   */
  static attributeValueToJSON(attributeValue) {
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
        return attributeValue.L.map(Dynamo.attributeValueToJSON)
      case 'M':
        return map(attributeValue.M, Dynamo.attributeValueToJSON)
      default:
        throw new TypeError(`Invalid attributeValue ${attributeValue}`)
    }
  }

  /**
   * @name describeTable
   *
   * @synopsis
   * ```coffeescript [specscript]
   * describeTable(tableName string) -> Promise<Object>
   * ```
   */
  describeTable(tableName) {
    return this.client.describeTable({ TableName: tableName }).promise()
  }

  /**
   * @name enableStreams
   *
   * @synopsis
   * ```coffeescript [specscript]
   * enableStreams(
   *   tableName string,
   *   options {
   *     streamViewType: 'NEW_IMAGE'|'OLD_IMAGE'|'NEW_AND_OLD_IMAGES'|'KEYS_ONLY',
   *   },
   * ) -> Promise<Object>
   * ```
   */
  enableStreams(tableName, options) {
    return this.client.updateTable({
      TableName: tableName,
      StreamSpecification: {
        StreamEnabled: true,
        StreamViewType: options.streamViewType,
      },
    }).promise()
  }

  /**
   * @name createTable
   *
   * @synopsis
   * ```coffeescript [specscript]
   * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
   *
   * createTable(
   *   tableName string,
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
  createTable(tableName, primaryKey, options) {
    const params = {
      TableName: tableName,
      KeySchema: Dynamo.KeySchema(primaryKey),
      AttributeDefinitions: Dynamo.AttributeDefinitions(primaryKey),
      BillingMode: get(options, 'BillingMode', 'PAY_PER_REQUEST'),
    }
    if (params.BillingMode == 'PROVISIONED') {
      params.ProvisionedThroughput = get(options, 'ProvisionedThroughput', {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      })
    }
    return this.client.createTable(params).promise()
  }

  /**
   * @name deleteTable
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteTable(tableName string) -> Promise<Object>
   * ```
   */
  deleteTable(tableName) {
    return this.client.deleteTable({
      TableName: tableName,
    }).promise()
  }

  /**
   * @name waitFor
   *
   * @synopsis
   * ```coffeescript [specscript]
   * waitFor(
   *   tablename string,
   *   status 'tableExists'|'tableNotExists'
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
   *   ItemCount: number, # The number of items in the specified table.
   *                      # DynamoDB updates this value approximately every six hours.
   *                      # Recent changes might not be reflected in this value.
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
   * Wait for a DynamoDB Table to reach a specified status
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
  waitFor(tableName, status) {
    return this.client.waitFor(status, {
      TableName: tableName,
    }).promise()
  }

  /**
   * @name createIndex
   *
   * @synopsis
   * ```coffeescript [specscript]
   * DynamoAttributeType = 'S'|'N'|'B'|'string'|'number'|'binary'
   *
   * createIndex(
   *   tableName string,
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
   * ) -> Promise<>
   * ```
   *
   * @description
   * ```javascript
   * const dynamo = new Dynamo('localhost:8000')
   * await dynamo.createIndex('test-tablename', [{ status: 'string', createTime: 'number' }])
   * ```
   *
   * @reference
   * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/LSI.html#LSI.Creating
   * https://stackoverflow.com/questions/36493323/adding-new-local-secondary-index-to-an-existing-dynamodb-table
   */
  async createIndex(tableName, index, options = {}) {
    const { Table } = await this.describeTable(tableName)
    const BillingMode = Table.BillingModeSummary?.BillingMode ?? 'PAY_PER_REQUEST'
    const params = {
      IndexName: Dynamo.Indexname(index),
      KeySchema: Dynamo.KeySchema(index),
      ...defaultsDeep(options, {
        Projection: {
          ProjectionType: 'ALL',
        },
        ...BillingMode == 'PROVISIONED' ? {
          ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5,
          },
        } : {}
      }),
    }

    return this.client.updateTable({
      TableName: tableName,
      AttributeDefinitions: Dynamo.AttributeDefinitions(index),
      GlobalSecondaryIndexUpdates: [{ Create: params }],
    }).promise()
  }
}

module.exports = Dynamo
