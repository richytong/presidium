const pipe = require('rubico/pipe')
const map = require('rubico/map')
const Dynamo = require('./Dynamo')
const getFirstKey = require('./internal/getFirstKey')
const hashJSON = require('./internal/hashJSON')
const objectFromEntries = require('./internal/objectFromEntries')

/**
 * @name parseQuery
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
 * parseQuery(abstractQuery function) -> dynamoQuery {
 *   KeyConditionExpression: string,
 *   ExpressionAttributeValues: Object,
 *   ExpressionAttributeNames: Object,
 *   ScanIndexForward: boolean,
 *   Limit: number
 * }
 * ```
 */

const parseQuery = function parseQuery(abstractQuery) {
  const $ = {
    fields: [],
    values: [],
    query: {},
    and(statements) {
      this.query.KeyConditionExpression = statements.join(' AND ')
      this.query.ExpressionAttributeNames = pipe([
        map(field => [`#${hashJSON(field)}`, field]),
        objectFromEntries,
      ])(this.fields)
      this.query.ExpressionAttributeValues = pipe([
        map(value => [`:${hashJSON(value)}`, Dynamo.AttributeValue(value)]),
        objectFromEntries,
      ])(this.values)
      return this
    },

    eq(field, value) {
      this.fields.push(field)
      this.values.push(value)
      return `#${hashJSON(field)} = :${hashJSON(value)}`
    },
    gt(field, value) {
      this.fields.push(field)
      this.values.push(value)
      return `#${hashJSON(field)} > :${hashJSON(value)}`
    },
    lt(field, value) {
      this.fields.push(field)
      this.values.push(value)
      return `#${hashJSON(field)} < :${hashJSON(value)}`
    },
    gte(field, value) {
      this.fields.push(field)
      this.values.push(value)
      return `#${hashJSON(field)} >= :${hashJSON(value)}`
    },
    lte(field, value) {
      this.fields.push(field)
      this.values.push(value)
      return `#${hashJSON(field)} <= :${hashJSON(value)}`
    },

    startsWith(field, prefix) {
      return `begins_with(#${hashJSON(field)}, :${hashJSON(prefix)})`
    },
    sortBy(field, value) {
      if (value != null) {
        if (typeof value.toLowerCase == 'function') {
          this.query.ScanIndexForward = value.toLowerCase() == 'asc'
        } else {
          this.query.ScanIndexForward = !(value != 1)
        }
      }
      return this
    },
    order(value) {
      if (value != null) {
        if (typeof value.toLowerCase == 'function') {
          this.query.ScanIndexForward = value.toLowerCase() == 'asc'
        } else {
          this.query.ScanIndexForward = !(value != 1)
        }
      }
      return this
    },
    limit(value) {
      this.query.Limit = value
      return this
    },
  }
  abstractQuery($)
  return $.query
}

/**
 * @name DynamoIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(dynamo string|DynamoDB|{
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
const DynamoIndex = function (dynamo, tablename, indexname) {
  if (typeof this == null || this.constructor != DynamoIndex) {
    return new DynamoIndex(dynamo, tablename, indexname)
  }
  this.dynamodb = new Dynamo(dynamo).dynamodb
  this.tablename = tablename
  this.indexname = indexname
}

/**
 * @name DynamoIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DynamoIndex(dynamo, tablename, indexname).query(abstractQuery $=>())
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
DynamoIndex.prototype.query = function query(abstractQuery, options) {
  return this.dynamodb.query({
    TableName: this.tablename,
    IndexName: this.indexname,
    ...parseQuery(abstractQuery),
    ...options,
  }).promise()
}

module.exports = DynamoIndex
