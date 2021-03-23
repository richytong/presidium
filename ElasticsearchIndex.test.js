const rubico = require('rubico')
const rubicox = require('rubico/x')
const assert = require('assert')
const Test = require('thunk-test')
const ElasticsearchIndex = require('./ElasticsearchIndex')

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
  callProp,
  includes,
} = rubicox

const test = Test('ElasticsearchIndex', async function () {
  const testIndex = new ElasticsearchIndex({
    node: 'http://localhost:9200/',
    index: 'test-index',
    mappings: {
      text: { type: 'text' },
    },
  })
  await testIndex.delete()
  await testIndex.ready

  await testIndex.indexDocument({
    text: 'hello there',
  }, {
    refresh: 'true',
  })
  await testIndex.indexDocument({
    text: 'hello world',
  }, {
    refresh: 'wait_for',
  })
  this.goodbyeWorldElasticsearchId = await testIndex.indexDocument({
    text: 'goodbye world',
  }, {
    refresh: 'false',
  }).then(pipe([
    callProp('json'),
    get('_id'),
  ]))
  await testIndex.refresh()

  {
    const response = await testIndex.match({
      text: 'hello',
    })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 2)
    assert.strictEqual(data.hits.hits.length, 2)
    const texts = data.hits.hits.map(get('_source.text'))
    assert(texts.every(includes('hello')))
  }

  {
    const response = await testIndex.updateDocument(this.goodbyeWorldElasticsearchId, {
      text: 'goodbye world?',
    }, {
      refresh: 'true',
    })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
  }

  {
    const response = await testIndex.getDocument(this.goodbyeWorldElasticsearchId)
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data._source.text, 'goodbye world?')
  }

  await testIndex.delete()
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
