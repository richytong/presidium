const Http = require('./Http')
const rubico = require('rubico')
const rubicox = require('rubico/x')
const querystring = require('querystring')

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
  noop,
} = rubicox

/**
 * @name ElasticsearchIndex
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options {
 *   node: string, // 'http://localhost:9200'
 *   index: string, // 'my-index'
 *   mappings: {
 *     properties: Object<(field string)=>({
 *       type: 'integer'|'keyword'|'text'|'boolean'|'binary'|'geo_point',
 *     })>
 *   },
 *   settings: {
 *     number_of_shards: number, // 1
 *     number_of_replicas: number, // 1
 *   },
 * }) -> ElasticsearchIndex
 * ```
 */

const ElasticsearchIndex = function (options) {
  this.http = new Http(`${options.node}/${options.index}`)
  this.ready = this.http.head('/').then(tap.if(
    not(eq(get('status'), 200)),
    async () => {
      const response = await this.http.put('/', {
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...options.mappings && {
            mappings: {
              properties: options.mappings,
            },
          },
          ...options.settings && {
            settings: {
              index: options.settings,
            },
          },
        }),
      })
      if (!response.ok) {
        const error = new Error(await response.text())
        error.httpStatusCode = response.status
        throw error
      }
    },
  ))
  return this
}

/**
 * @name ElasticsearchIndex.prototype.refresh
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).refresh() -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-refresh.html
 */
ElasticsearchIndex.prototype.refresh = function refresh() {
  return this.http.get('/_refresh')
}

/**
 * @name ElasticsearchIndex.prototype.delete
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).delete() -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/indices-delete.html
 */
ElasticsearchIndex.prototype.delete = function _delete() {
  return this.http.delete('/')
}

/**
 * @name ElasticsearchIndex.prototype.indexDocument
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).indexDocument(
 *   elasticsearchDocument Object,
 *   options? {
 *     refresh: 'false'|'true'|'wait_for', // wait_for - wait for changes to be visible before replying
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
ElasticsearchIndex.prototype.indexDocument = function indexDocument(
  elasticsearchDocument, options,
) {
  return this.http.post(`/_doc?${querystring.stringify({
    refresh: get('refresh', 'false')(options),
  })}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(elasticsearchDocument),
  })
}

/**
 * @name ElasticsearchIndex.prototype.updateDocument
 *
 * @synopsis
 * ```coffeescript [specscript]
 * newn Elasticsearch(options).updateDocument(
 *   elasticsearchDocumentId string,
 *   documentUpdate Object,
 *   options {
 *     refresh: 'false'|'true'|'wait_for', // wait_for - wait for changes to be visible before replying
 *     retry_on_conflict: number, // how many times operation should be retried when a conflict occurs. Default: 0
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
ElasticsearchIndex.prototype.updateDocument = function updateDocument(
  elasticsearchDocumentId, documentUpdate, options,
) {
  return this.http.post(`/_update/${elasticsearchDocumentId}?${
    querystring.stringify({
      ...pick(['refresh', 'retry_on_conflict'])(options),
    })
  }`, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      doc: documentUpdate,
    }),
  })
}

/**
 * @name ElasticsearchIndex.prototype.getDocument
 *
 * @synopsis
 * ```coffeescript [specscript]
 * ElasticsearchIndex(options).getDocument(
 *   elasticsearchDocumentId string,
 *   options {
 *     refresh: 'false'|'true'|'wait_for', // wait_for - wait for changes to be visible before replying
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
ElasticsearchIndex.prototype.getDocument = function getDocument(
  elasticsearchDocumentId, options,
) {
  return this.http.get(`/_doc/${elasticsearchDocumentId}?${
    querystring.stringify({
      ...pick(['refresh'])(options),
    })
  }`)
}

/**
 * @name ElasticsearchIndex.prototype.match
 *
 * @synopsis
 * ```coffeescript [specscript]
 * ElasticsearchIndex(options).match(
 *   matchDSL {
 *     [field string]: string
 *     operator: 'OR'|'AND',
 *   },
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   },
 * ) -> ElasticsearchIndex
 * ```
 *
 * @description
 * match query DSL reference:
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-match-query.html
 *
 * ```javascript
 * const myIndex = new ElasticsearchIndex({
 *   node: 'http://localhost:9200/',
 *   index: 'my-index',
 * })
 *
 * myIndex.match(
 *   { myField: 'this is a test' }, 
 *   { size: 100 },
 * )
 * ```
 */

ElasticsearchIndex.prototype.match = function match(matchDSL, options) {
  return this.http.post(`/_search`, {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: {
        match: matchDSL,
      },
      ...pick(['size', 'from', 'to'])(options)
    }),
  })
}

module.exports = ElasticsearchIndex
