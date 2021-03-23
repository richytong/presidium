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
 * @name ElasticsearchIndex.prototype.query
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).query(
 *   dsl Object,
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   },
 * )
 * ```
 */
ElasticsearchIndex.prototype.query = function query(dsl, options) {
  return this.http.post('/_search', {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: dsl,
      ...pick(['size', 'from', 'to'])(options)
    }),
  })
}

/**
 * @name ElasticsearchIndex.prototype.term
 *
 * @synopsis
 * ```coffeescript [specscript]
 * newn Elasticsearch(options).term(
 *   termDSL {
 *     [field string]: {
 *       value: string,
 *       boost?: number,
 *     },
 *   },
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-term-query.html
 */
ElasticsearchIndex.prototype.term = function term(termDSL, options) {
  return this.query({ term: termDSL }, options)
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
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
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
  return this.query({ match: matchDSL }, options)
}

/**
 * @name ElasticsearchIndex.prototype.bool
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).bool(
 *   boolDSL {
 *     must?: Array|DSL, // clause (query) must appear, contributes to score
 *     filter?: Array|DSL, // clause (query) must appear, does not contribute to score
 *     should?: Array|DSL, // clause (query) _should_ appear, contributes to score
 *     must_not?: Array|DSL, // clause (query) must not appear, ignores scoring
 *   },
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-bool-query.html
 */

ElasticsearchIndex.prototype.bool = function bool(boolDSL, options) {
  return this.query({ bool: boolDSL }, options)
}

/**
 * @name ElasticsearchIndex.prototype.disMax
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).disMax(
 *   disMaxDSL {
 *     queries: Array<DSL>,
 *     tie_breaker?: number, // [0, 1.0] used to increase relevance scores of documents matching multiple query clauses
 *   },
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-dis-max-query.html
 */
ElasticsearchIndex.prototype.disMax = function disMax(disMaxDSL, options) {
  return this.query({ dis_max: disMaxDSL }, options)
}

/**
 * @name ElasticsearchIndex.prototype.functionScore
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new ElasticsearchIndex(options).functionScore(
 *   functionScoreDSL {
 *     query: DSL,
 *     boost?: number, // boost for the whole query
 *     functions?: Array<{
 *       filter: DSL,
 *       weight?: number, // multiplies score in final computed score for a document
 *       script_score?: {
 *         script: {
 *           source: string, // Elasticsearch script expression, e.g. `Math.log(2 + doc['my-int'].value)`
 *           params?: Object,
 *         },
 *       },
 *       random_score?: {}|{ // provide seed and field for reproducible scores
 *         seed: number,
 *         field: string, // e.g. '_seq_no' (builtin)
 *       },
 *       field_value_factor?: {
 *         field: string, // field in document e.g. 'my-field'
 *         factor?: number, // multiply field value
 *         modifier?: // modify field value, default 'none'
 *           'none' // no multiplier
 *           |'log' // common log
 *           |'log1p' // add 1 then common log
 *           |'log2p' // add 2 then common log
 *           |'ln' // natural log
 *           |'ln1p' // add 1 then natural log
 *           |'ln2p' // add 2 then common log
 *           |'square' // ^2
 *           |'sqrt' // square root
 *           |'reciprocal', // 1/x
 *         missing: number, // value to use in case of missing field
 *       },
 *       ['linear'|'exp'|'gauss']: { // decay function to use
 *         [field string]: { // Note: only numeric, date, and geo_point are supported
 *           origin: number|string, // origin for calculating distance. Must be given as a number for numeric field, date for date fields, and geo point for geo fields
 *           scale: number|string, // distance from origin + offset at which computed score == `decay` parameter.
 *                                 // geo: default unit meters [m] (e.g. 10m)
 *                                 // date: default milliseconds [ms] (e.g. 1h, 10d)
 *           offset: number|string, // only compute decay function for documents with a distance greater than this parameter, default 0
 *           decay: number, // defines how documents are scored at the distance given in `scale`. Default 0.5
 *         },
 *         multi_value_mode: // for multi-value fields, determine which value to use for calculating distance
 *           'min' // use minimum computed distance
 *           |'max' // use maximum computed distance
 *           |'avg' // use average of computed distances
 *           |'sum' // use sum of all distances
 *       },
 *     }>
 *     max_boost?: number, // maximum a document's score can be boosted
 *     score_mode?: // specify how individual computed scores are combined
 *       'multiply' // scores are multiplied (default)
 *       |'sum' // add scores
 *       |'avg' // average scores
 *       |'first' // first function that has a matching filter is applied
 *       |'max' // max of scores
 *       |'min', // min of scores
 *     boost_mode?: // specify how final computed score is combined with score of the query
 *       'multiply' // query score and function score are multiplied (default)
 *       |'replace' // only function score is used, query score is ignored
 *       |'sum' // add query score and function score
 *       |'avg' // add query score and function score
 *       |'max' // maximum of query score and function score
 *       |'min', // minimum of query score and function score
 *   },
 *   options? {
 *     size: number,
 *     from: number,
 *     to: number,
 *   }
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-function-score-query.html
 */
ElasticsearchIndex.prototype.functionScore = function functionScore(
  functionScoreDSL, options,
) {
  return this.query({ function_score: functionScoreDSL }, options)
}

module.exports = ElasticsearchIndex
