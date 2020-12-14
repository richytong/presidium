const assert = require('assert')
const Test = require('thunk-test')
const Elasticsearch = require('./Elasticsearch')

module.exports = Test('Elasticsearch', Elasticsearch)
  .case('http://localhost:9200/', async function (elasticsearch) {
    const catHealth = await elasticsearch.ready
    assert.equal(typeof elasticsearch.create, 'function')
    assert.equal(typeof elasticsearch.search, 'function')
    assert.equal(typeof elasticsearch.delete, 'function')
    assert.equal(typeof elasticsearch.count, 'function')
    assert.equal(typeof elasticsearch.cluster.health, 'function')
  })
