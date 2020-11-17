const pipe = require('rubico/pipe')
const map = require('rubico/map')
const Dynamo = require('./Dynamo')
const getFirstKey = require('./internal/getFirstKey')
const hashJSON = require('./internal/hashJSON')
const objectFromEntries = require('./internal/objectFromEntries')

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
 * DynamoIndex(connection string|DynamoDB|{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 * }, tablename string, indexname string) -> DynamoTable
 * ```
 *
 * @description
 * ```javascript
 * DynamoIndex('http://localhost:8000/', 'my-table', {
 *   myHashKey: string,
 * }).query($ => {
 *   $.and([
 *     $.eq('hashKey', 'some-value'),
 *     $.gt('createTime', 1000),
 *   ])
 *   $.sortBy('createTime', 1)
 *   $.limit(1000)
 * })
 * ```
 */
const DynamoIndex = function (connection, tablename, indexname) {
  if (this == null || this.constructor != DynamoIndex) {
    return new DynamoIndex(connection, tablename, indexname)
  }
  this.connection = new Dynamo(connection).connection
  this.tablename = tablename
  this.indexname = indexname
  return this
}

/**
 * @name DynamoIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(connection, tablename, indexname).query($query $=>())
 * ```
 *
 * @description
 * Query a DynamoDB Index.
 *
 * ```javascript
 * DynamoIndex(
 *   'http://localhost:8000/',
 *   'my-table',
 *   'hashKey-createTime-index',
 * ).query($ => $.and([
 *   $.eq('hashKey', 'some-value'),
 *   $.gt('createTime', 1000),
 * ]).sortBy('createTime', 1).limit(1000), {
 *   ExclusiveStartKey: Object<DynamoAttributeValue>,
 * })
 * ```
 */
DynamoIndex.prototype.query = function query($query, options) {
  return this.connection.query({
    TableName: this.tablename,
    IndexName: this.indexname,
    ...dynamoParseQuery($query),
    ...options,
  }).promise()
}

module.exports = DynamoIndex
