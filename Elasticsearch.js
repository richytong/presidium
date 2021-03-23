const { Client } = require('@elastic/elasticsearch')

/**
 * @name Elasticsearch
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Elasticsearch(node string) -> Elasticsearch
 * ```
 *
 * @description
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/rest-apis.html
 *
 * https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/7.x/introduction.html
 * https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/7.x/api-reference.html
 * https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html
 * https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html
 *
 * ```javascript
 * Elasticsearch('http://localhost:9200')
 * ```
 */
const Elasticsearch = function (node) {
  const elasticsearch = new Client({ node })
  elasticsearch.ready = elasticsearch.cat.health()
  return elasticsearch
}

module.exports = Elasticsearch
