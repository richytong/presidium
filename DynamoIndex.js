const rubico = require('rubico')
const uniq = require('rubico/x/uniq')
const find = require('rubico/x/find')
const flatten = require('rubico/x/flatten')
const isDeepEqual = require('rubico/x/isDeepEqual')
const forEach = require('rubico/x/forEach')
const Dynamo = require('./Dynamo')
const hashJSON = require('./internal/hashJSON')
const trim = require('./internal/trim')

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

/**
 * @name DynamoIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(options {
 *   name: string,
 *   key: [
 *     { [hashKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *     { [sortKey string]: 'S'|'string'|'N'|'number'|'B'|'binary' },
 *   ],
 *   table: string,
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string,
 * }) -> DynamoIndex
 * ```
 */

const DynamoIndex = function (options) {
  if (this == null || this.constructor != DynamoIndex) {
    return new DynamoIndex(options)
  }
  this.table = options.table
  this.key = options.key
  this.name = Dynamo.Indexname(this.key)
  this.dynamo = new Dynamo(pick([
    'accessKeyId',
    'secretAccessKey',
    'region',
    'endpoint',
  ])(options))
  this.connection = this.dynamo.connection

  this.ready = this.inspect().then(pipe([
    indexData => indexData ?? this.dynamo.createIndex(this.table, this.key)
      .then(pipe([
        get('TableDescription.GlobalSecondaryIndexes'),
        find(item => isDeepEqual(item.IndexName, this.name)),
      ])),
    async indexData => {
      let isIndexActive = indexData.IndexStatus == 'ACTIVE'
      while (!isIndexActive) {
        await new Promise(resolve => setTimeout(resolve, 1000))
        isIndexActive = await this.inspect().then(eq('ACTIVE', get('IndexStatus')))
      }
    },
  ]))
  return this
}

/**
 * @name DynamoIndex.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(options).inspect() -> Promise<Object>
 * ```
 */
DynamoIndex.prototype.inspect = function dynamoIndexInspect() {
  return this.dynamo.describeTable(this.table)
    .then(pipe([
      get('Table.GlobalSecondaryIndexes'),
      find(eq(this.name, get('IndexName'))),
    ]))
}

/**
 * @name DynamoIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(options).query(
 *   filterStatement string, // hashKey = :a AND sortKey < :b
 *   values {
 *     [hashKey]: string|number|Buffer|TypedArray,
 *     [sortKey]: string|number|Buffer|TypedArray,
 *   },
 *   options? {
 *     limit: number,
 *     exclusiveStartKey: Object<string=>DynamoAttributeValue>
 *     scanIndexForward: boolean, // default true for ASC
 *     projectionExpression: string, // 'fieldA,fieldB,fieldC'
 *     select: 'ALL_ATTRIBUTES'|'ALL_PROJECTED_ATTRIBUTES'|'COUNT'|'SPECIFIC_ATTRIBUTES',
 *   },
 * ) -> Promise<{ Items: Array<Object> }>
 * ```
 *
 * @description
 * Query a DynamoDB Index.
 *
 * Note: use of reserved words is fine due to hashing of field names done by this function
 *
 * ```javascript
 * new DynamoIndex({
 *   name: 'name-age-index',
 *   table: 'my-table',
 *   key: [{ name: 'string' }, { age: 'number' }],
 *   endpoint: 'http://localhost:5000',
 * }).query('name = :name AND age < :age', {
 *   name: 'George',
 *   age: 33,
 * })
 * ```
 */

DynamoIndex.prototype.query = async function dynamoIndexQuery(filterStatement, values, options = {}) {
  await this.ready
  const statements = filterStatement.trim().split(/\s+AND\s+/)
  let statementsIndex = -1
  while (++statementsIndex < statements.length) {
    if (statements[statementsIndex].includes('BETWEEN')) {
      statements[statementsIndex] += ` AND ${statements.splice(statementsIndex + 1, 1)}`
    }
  }

  return this.connection.query({
    TableName: this.table,
    IndexName: this.name,
    KeyConditionExpression: statements.map(statement => {
      if (statement.startsWith('begins_with')) {
        const [field, prefix] = statement // 'begins_with(name, :prefix)'
          .split(/[()]/)[1] // 'name, :prefix'
          .split(',').map(trim) // ['name', ':prefix']
        return `begins_with(#${hashJSON(field)}, ${prefix})`
      }
      const [field, rest] = statement.split(/ (.+)/)
      return `#${hashJSON(field)} ${rest}`
    }).join(' AND '),

    ExpressionAttributeNames: pipe([
      flatten,
      filter(gt(get('length'), 0)),
      uniq,
      transform(
        map(field => ({ [`#${hashJSON(field)}`]: field })),
        {}),
    ])([
      statements.map(statement => statement.trim().startsWith('begins_with')
        ? statement.split(/[()]/)[1].split(',').map(trim)[0] // begins_with(field, :field)
        : statement.split(/ (.+)/)[0]), // field ...
      options.projectionExpression
        ? options.projectionExpression.split(',')
        : [],
    ]),
    ExpressionAttributeValues: map.entries(
      ([placeholder, value]) => [`:${placeholder}`, Dynamo.AttributeValue(value)],
    )(values),

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
    ...options.select && { Select: options.select },
  }).promise()
}

module.exports = DynamoIndex
