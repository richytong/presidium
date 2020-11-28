const rubico = require('rubico')
const uniq = require('rubico/x/uniq')
const flatten = require('rubico/x/flatten')
const Dynamo = require('./Dynamo')
const getFirstKey = require('./internal/getFirstKey')
const getFirstValue = require('./internal/getFirstValue')
const hashJSON = require('./internal/hashJSON')
const objectFromEntries = require('./internal/objectFromEntries')
const replace = require('./internal/replace')
const match = require('./internal/match')
const trim = require('./internal/trim')
const parseJSON = require('./internal/parseJSON')
const stringifyJSON = require('./internal/stringifyJSON')

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
 * @name dynamoParseQuery
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoQuery = Object
 * $ = {
 *   and: (statements Array<string>)=>this,
 *   eq: (field string, value string|number|TypedArray)=>string,
 *   gt: (field string, value string|number|TypedArray)=>string,
 *   lt: (field string, value string|number|TypedArray)=>string,
 *   gte: (field string, value string|number|TypedArray)=>string,
 *   lte: (field string, value string|number|TypedArray)=>string,
 *   startsWith: (field string, prefix string)=>string,
 *   order: (1|-1)=>this,
 *   limit: number=>this,
 * }
 *
 * dynamoParseQuery($query function) -> dynamoQuery {
 *   KeyConditionExpression: string,
 *   ExpressionAttributeValues: Object,
 *   ExpressionAttributeNames: Object,
 *   ScanIndexForward: boolean,
 *   Limit: number
 * }
 * ```
 */

const dynamoParseQuery = function dynamoParseQuery($query) {
  const $ = {
    fields: [],
    values: [],
    statements: [],
    ScanIndexForward: null,
    Limit: null,

    and(statements) {
      return this
    },

    eq(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`#${hashJSON(field)} = :${hashJSON(value)}`)
      return this
    },

    gt(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`#${hashJSON(field)} > :${hashJSON(value)}`)
      return this
    },

    lt(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`#${hashJSON(field)} < :${hashJSON(value)}`)
      return this
    },

    gte(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`#${hashJSON(field)} >= :${hashJSON(value)}`)
      return this
    },

    lte(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`#${hashJSON(field)} <= :${hashJSON(value)}`)
      return this
    },

    startsWith(field, value) {
      this.fields.push(field)
      this.values.push(value)
      this.statements.push(`begins_with(#${hashJSON(field)}, :${hashJSON(value)})`)
      return this
    },

    beginsWith(field, value) {
      return this.startsWith(field, value)
    },
    between(field, start, stop) {
      this.fields.push(field)
      this.values.push(start, stop)
      this.statements.push(
        `#${hashJSON(field)} BETWEEN :${hashJSON(start)} AND :${hashJSON(stop)}`)
    },

    sort(value) {
      if (typeof value == 'string') {
        this.ScanIndexForward = value.toLowerCase() == 'asc'
      } else {
        this.ScanIndexForward = value == 1
      }
      return this
    },
    sortBy(field, value) {
      return this.sort(value)
    },
    limit(value) {
      this.Limit = value
      return this
    },
  }
  $query($)
  return {
    KeyConditionExpression: $.statements.join(' AND '),
    ExpressionAttributeNames: pipe([
      map(field => [`#${hashJSON(field)}`, field]),
      objectFromEntries,
    ])($.fields),
    ExpressionAttributeValues: pipe([
      map(value => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)]),
      objectFromEntries,
    ])($.values),
    Limit: $.Limit,
    ScanIndexForward: $.ScanIndexForward,
  }
}

/**
 * @name DynamoIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(index, options|{
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
const DynamoIndex = function (index, options) {
  if (this == null || this.constructor != DynamoIndex) {
    return new DynamoIndex(index, options)
  }
  this.connection = options.endpoint
    ? new Dynamo(options.endpoint).connection
    : new Dynamo(pick(['accessKeyId', 'secretAccessKey', 'region'])(options))
  this.index = index
  this.attributeNames = options.key.map(getFirstKey)
  this.attributeValues = options.key.map(getFirstValue)
  this.table = options.table
  return this
}

/**
 * @name DynamoIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(index, options).query(
 *   filterStatement string, // hashKey = :a AND sortKey < :b
 *   values {
 *     [hashKey]: string|number|Buffer|TypedArray,
 *     [sortKey]: string|number|Buffer|TypedArray,
 *   },
 *   options? {
 *     limit: number,
 *     exclusiveStartKey: {
 *       [hashKey]: string|number|Buffer|TypedArray,
 *       [sortKey]: string|number|Buffer|TypedArray,
 *     }, // cursor
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
 * Note: avoid these reserved words for field names
 * https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
 *
 * ```javascript
 * new DynamoIndex('name-age-index', {
 *   table: 'my-table',
 *   key: [{ name: 'string' }, { age: 'number' }],
 *   endpoint: 'http://localhost:5000',
 * }).query('name = :name AND age < :age', {
 *   name: 'George',
 *   age: 33,
 * })
 * ```
 */

DynamoIndex.prototype.query = function query(filterStatement, values, options = {}) {
  const statements = filterStatement.trim().split(/\s+AND\s+/)
  let statementsIndex = -1
  while (++statementsIndex < statements.length) {
    if (statements[statementsIndex].includes('BETWEEN')) {
      statements[statementsIndex] += ` AND ${statements.splice(statementsIndex + 1, 1)}`
    }
  }

  return this.connection.query({
    TableName: this.table,
    IndexName: this.index,
    KeyConditionExpression: statements.map(statement => {
      if (statement.startsWith('begins_with')) {
        const [field, prefix] = statement // 'begins_with(name, :prefix)'
          .split(/[\(\)]/)[1] // 'name, :prefix'
          .split(',').map(trim) // ['name', ':prefix']
        return `begins_with(#${hashJSON(field)}, ${prefix})`
      } else {
        const [field, rest] = statement.split(/ (.+)/)
        return `#${hashJSON(field)} ${rest}`
      }
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
        ? statement.split(/[\(\)]/)[1].split(',').map(trim)[0] // begins_with(field, :field)
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
      ExclusiveStartKey: parseJSON(options.exclusiveStartKey),
    },
    ...options.scanIndexForward != null && {
      ScanIndexForward: options.scanIndexForward
    },
    ...options.projectionExpression && {
      ProjectionExpression: options.projectionExpression
        .split(',').map(field => `#${hashJSON(field)}`).join(','),
    },
    ...options.select && { Select: options.select },
  }).promise().then(dynamoResponse => 'LastEvaluatedKey' in dynamoResponse ? ({
    ...dynamoResponse,
    LastEvaluatedKey: stringifyJSON(dynamoResponse.LastEvaluatedKey),
  }) : dynamoResponse)
}

module.exports = DynamoIndex
