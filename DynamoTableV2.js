require('rubico/global')
const Dynamo = require('./Dynamo')
const {
  DynamoDBClient,
  DescribeTableCommand,
  CreateTableCommand,
  DeleteTableCommand,
  PutItemCommand,
  GetItemCommand,
  UpdateItemCommand,
  DeleteItemCommand,
  ScanCommand,
  QueryCommand,
} = require('@aws-sdk/client-dynamodb')
const hashJSON = require('./internal/hashJSON')
const join = require('./internal/join')
const sleep = require('./internal/sleep')
const createExpressionAttributeNames =
  require('./internal/createExpressionAttributeNames')
const createExpressionAttributeValues =
  require('./internal/createExpressionAttributeValues')
const createKeyConditionExpression =
  require('./internal/createKeyConditionExpression')
const createFilterExpression = require('./internal/createFilterExpression')

/**
 * @name DynamoTableV2
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DynamoTableV2(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> DynamoTableV2
 * ```
 */
class DynamoTableV2 {
  constructor(options) {
    this.tableName = options.name
    this.primaryKey = options.key
    this.billingMode = options.billingMode ?? 'PAY_PER_REQUEST'

    if (options.billingMode == 'PROVISIONED') {
      this.rcu = options.rcu ?? 5
      this.wcu = options.wcu ?? 5
    }

    this.client = new DynamoDBClient(pick(options, [
      'accessKeyId',
      'secretAccessKey',
      'region',
      'endpoint',
    ]))

    this.ready = this.inspect().then(async input => {
      await this.waitForTableExists()
    }).catch(async error => {
      if (error.name == 'ResourceNotFoundException') {
        // continue
      } else {
        throw error
      }
      await this.createTable()
      await this.waitForTableExists()
    })
  }

  /**
   * @name inspect
   *
   * @synopsis
   * ```coffeescript [specscript]
   * inspect() -> Promise<Object>
   * ```
   */
  inspect() {
    const command = new DescribeTableCommand({ TableName: this.tableName })
    return this.client.send(command)
  }

  /**
   * @name createTable
   *
   * @synopsis
   * ```coffeescript [specscript]
   * createTable() -> Promise<>
   * ```
   */
  createTable() {
    const params = {
      TableName: this.tableName,
      KeySchema: Dynamo.KeySchema(this.primaryKey),
      AttributeDefinitions: Dynamo.AttributeDefinitions(this.primaryKey),
      BillingMode: this.billingMode,
    }
    if (params.BillingMode == 'PROVISIONED') {
      params.ProvisionedThroughput = {
        ReadCapacityUnits: this.rcu,
        WriteCapacityUnits: this.wcu,
      }
    }
    const command = new CreateTableCommand(params)
    return this.client.send(command)
  }

  /**
   * @name destroy
   *
   * @synopsis
   * ```coffeescript [specscript]
   * destroy() -> Promise<>
   * ```
   */
  async destroy() {
    await this.deleteTable()
    await this.waitForTableNotExists()
  }

  /**
   * @name deleteTable
   *
   * @synopsis
   * ```coffeescript [specscript]
   * deleteTable() -> Promise<>
   * ```
   */
  deleteTable() {
    const params = {
      TableName: this.tableName,
    }
    const command = new DeleteTableCommand(params)
    return this.client.send(command)
  }

  /**
   * @name waitForTableExists
   *
   * @synopsis
   * ```coffeescript [specscript]
   * waitForTableExists() -> Promise<Object>
   * ```
   */
  async waitForTableExists() {
    const command = new DescribeTableCommand({ TableName: this.tableName })
    let res = await this.client.send(command)
    while (res.Table.TableStatus != 'ACTIVE') {
      await sleep(500)
      res = await this.client.send(command)
    }
  }

  /**
   * @name waitForTableNotExists
   *
   * @synopsis
   * ```coffeescript [specscript]
   * waitForTableNotExists() -> Promise<Object>
   * ```
   */
  async waitForTableNotExists() {
    const command = new DescribeTableCommand({ TableName: this.tableName })
    try {
      while (true) {
        await sleep(500)
        const res = await this.client.send(command)
      }
    } catch (error) {
      if (error.name == 'ResourceNotFoundException') {
        // success
      } else {
        throw error
      }
    }
  }

  /**
   * @name putItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * putItem(item object) -> Promise<>
   * ```
   */
  putItem(item) {
    const params = {
      TableName: this.tableName,
      Item: map(item, Dynamo.AttributeValue),
    }
    const command = new PutItemCommand(params)
    return this.client.send(command)
  }

  /**
   * @name getItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * getItem(
   *   key object
   *   options? {
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD',
   *   },
   * ) -> Promise<{ Item: DynamoAttributeValue }>
   * ```
   */
  getItem(key, options = {}) {
    const params = {
      TableName: this.tableName,
      Key: map(key, Dynamo.AttributeValue),
      ...options,
    }
    const command = new GetItemCommand(params)
    return this.client.send(command).then(result => {
      if (result.Item == null) {
        const error = new Error(`Item not found for ${JSON.stringify(key)}`)
        error.tableName = this.name
        throw error
      }
      return result
    })
  }

  /**
   * @name updateItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * updateItem(
   *   key object,
   *   values object,
   *   options? {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   },
   * ) -> Promise<{ Attributes?: object }>
   * ```
   */
  updateItem(key, values, options = {}) {
    const params = {
      TableName: this.tableName,
      Key: map(key, Dynamo.AttributeValue),

      UpdateExpression: pipe(values, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} = :${hashJSON(value)}`),
        join(', '),
        expression => `set ${expression}`,
      ]),

      ExpressionAttributeNames: map.entries(
        values,
        ([key, value]) => [`#${hashJSON(key)}`, key],
      ),
      ExpressionAttributeValues: map.entries(
        values,
        ([key, value]) => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)],
      ),
      ...options,
    }

    const command = new UpdateItemCommand(params)
    return this.client.send(command)
  }

  /**
   * @name deleteItem
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
  deleteItem(key, options = {}) {
    const params = {
      TableName: this.tableName,
      Key: map(key, Dynamo.AttributeValue),
      ...options,
    }
    const command = new DeleteItemCommand(params)
    return this.client.send(command)
  }

  /**
   * @name incrementItem
   *
   * @synopsis
   * ```coffeescript [specscript]
   * incrementItem(
   *   key object,
   *   incrementUpdates object,
   *   options? {
   *     ConditionExpression: string, // 'attribute_exists(username)'
   *     ReturnConsumedCapacity?: 'INDEXES'|'TOTAL'|'NONE',
   *     ReturnItemCollectionMetrics?: 'SIZE'|'NONE',
   *     ReturnValues?: 'NONE'|'ALL_OLD'|'UPDATED_OLD'|'ALL_NEW'|'UPDATED_NEW',
   *   },
   * ) -> Promise<{ Attributes?: object }>
   * ```
   */
  incrementItem(key, incrementUpdates, options) {
    const params = {
      TableName: this.tableName,
      Key: map(key, Dynamo.AttributeValue),
      UpdateExpression: pipe(incrementUpdates, [
        Object.entries,
        map(([key, value]) => `#${hashJSON(key)} :${hashJSON(value)}`),
        join(', '),
        expression => `add ${expression}`,
      ]),
      ExpressionAttributeNames: map.entries(
        incrementUpdates,
        ([key, value]) => [`#${hashJSON(key)}`, key],
      ),
      ExpressionAttributeValues: map.entries(
        incrementUpdates,
        ([key, value]) => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)],
      ),
      ...options,
    }
    const command = new UpdateItemCommand(params)
    return this.client.send(command)
  }

  /**
   * @name scan
   *
   * @synopsis
   * ```coffeescript [specscript]
   * scan(options {
   *   [Ll]imit?: number = 1000,
   *   [Ee]xclusiveStartKey?: Object<string=>DynamoAttributeValue>
   * }) -> Promise<{
   *   Items: Array<Object<string=>DynamoAttributeValue>>
   *   Count: number, // number of Items
   *   ScannedCount: number, // number of items evaluated before scanFilter is applied
   *   LastEvaluatedKey: Object<string=>DynamoAttributeValue>,
   * }>
   * ```
   */
  scan(options = {}) {
    const params = {
      TableName: this.tableName,
      Limit: options.limit ?? options.Limit ?? 1000,
      ...options.exclusiveStartKey == null ? {} : {
        ExclusiveStartKey: options.exclusiveStartKey,
      },
      ...options.ExclusiveStartKey == null ? {} : {
        ExclusiveStartKey: options.ExclusiveStartKey,
      },
    }
    const command = new ScanCommand(params)
    return this.client.send(command)
  }

  /**
   * @name query
   *
   * @synopsis
   * ```coffeescript [specscript]
   * query(
   *   keyConditionExpression string, // hashKey = :a AND sortKey < :b
   *   values {
   *     [hashKey]: string|number|Buffer|TypedArray,
   *     [sortKey]: string|number|Buffer|TypedArray,
   *   },
   *   options? {
   *     [Ll]imit: number,
   *     [Ee]xclusiveStartKey: Object<string=>DynamoAttributeValue>
   *     [Ss]canIndexForward: boolean, // default true for ASC
   *     [Pp]rojectionExpression: string, // 'fieldA,fieldB,fieldC'
   *     [Ff]ilterExpression: string, // 'fieldA >= :someValueForFieldA'
   *     [Ss]elect: 'ALL_ATTRIBUTES'|'ALL_PROJECTED_ATTRIBUTES'|'COUNT'|'SPECIFIC_ATTRIBUTES',
   *     [Cc]onsistentRead: boolean, // true to perform a strongly consistent read (eventually consistent by default)
   *   },
   * ) -> Promise<{ Items: Array<Object> }>
   * ```
   *
   * @description
   * Note: only works for tables with a sort and hash key
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
      typeof options.filterExpression == 'string' ? options.filterExpression.trim().split(/\s+AND\s+/)
      : typeof options.FilterExpression == 'string' ? options.FilterExpression.trim().split(/\s+AND\s+/)
      : []
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
      projectionExpression: options.projectionExpression ?? options.ProjectionExpression,
    })

    const ExpressionAttributeValues = createExpressionAttributeValues({ values })

    const KeyConditionExpression = createKeyConditionExpression({
      keyConditionStatements,
    })

    const FilterExpression = createFilterExpression({
      filterExpressionStatements,
    })

    const params = {
      TableName: this.tableName,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      KeyConditionExpression,

      ...filterExpressionStatements.length > 0 && { FilterExpression },

      ...options.limit == null ? {} : { Limit: options.limit },
      ...options.Limit == null ? {} : { Limit: options.Limit },

      ...options.exclusiveStartKey == null ? {} : {
        ExclusiveStartKey: options.exclusiveStartKey,
      },
      ...options.ExclusiveStartKey == null ? {} : {
        ExclusiveStartKey: options.ExclusiveStartKey,
      },

      ...options.scanIndexForward == null ? {} : {
        ScanIndexForward: options.scanIndexForward
      },
      ...options.ScanIndexForward == null ? {} : {
        ScanIndexForward: options.ScanIndexForward
      },

      ...options.projectionExpression == null ? {} : {
        ProjectionExpression: options.projectionExpression
        .split(',').map(field => `#${hashJSON(field)}`).join(','),
      },
      ...options.ProjectionExpression == null ? {} : {
        ProjectionExpression: options.ProjectionExpression
        .split(',').map(field => `#${hashJSON(field)}`).join(','),
      },

      ...options.select == null ? {} : { Select: options.select },
      ...options.Select == null ? {} : { Select: options.Select },

      ...options.consistentRead == null ? {} : {
        ConsistentRead: options.consistentRead,
      },
      ...options.ConsistentRead == null ? {} : {
        ConsistentRead: options.ConsistentRead,
      },
    }

    const command = new QueryCommand(params)
    return this.client.send(command)
  }
}

module.exports = DynamoTableV2
