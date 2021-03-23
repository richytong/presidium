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
      slug: { type: 'keyword' },
      text: { type: 'text' },
      rating: { type: 'integer' },
    },
  })
  await testIndex.ready

  await testIndex.indexDocument({
    slug: 'hello-there',
    text: 'hello there',
    rating: 9,
  }, {
    refresh: 'true',
  })
  await testIndex.indexDocument({
    slug: 'hello-world',
    text: 'hello world',
    rating: 8,
  }, {
    refresh: 'wait_for',
  })
  this.goodbyeWorldElasticsearchId = await testIndex.indexDocument({
    slug: 'goodbye-world',
    text: 'goodbye world',
    rating: 7,
  }, {
    refresh: 'false',
  }).then(pipe([
    callProp('json'),
    get('_id'),
  ]))
  await testIndex.refresh()

  {
    const response = await testIndex.term({
      slug: 'hello-world',
    })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 1)
    assert.strictEqual(data.hits.hits.length, 1)
    const doc = data.hits.hits[0]._source
    assert.strictEqual(doc.slug, 'hello-world')
  }

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
    const response = await testIndex.multiMatch({
      query: 'hello',
      fields: ['text', 'slug'],
    })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 2)
    assert.strictEqual(data.hits.hits.length, 2)
    const texts = data.hits.hits.map(get('_source.text'))
    assert(texts.every(includes('hello')))
  }

  {
    const response = await testIndex.bool({
      must_not: [
        { term: { slug: 'goodbye-world' } },
      ],
    }, { size: 100 })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 2)
    assert.strictEqual(data.hits.hits.length, 2)
    const texts = data.hits.hits.map(get('_source.text'))
    assert(texts.every(includes('hello')))
  }

  {
    const response = await testIndex.disMax({
      queries: [
        { term: { slug: 'hello-there' } },
        { term: { slug: 'hello-world' } },
      ],
      tie_breaker: 0,
    }, { size: 100 })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 2)
    assert.strictEqual(data.hits.hits.length, 2)
    const texts = data.hits.hits.map(get('_source.text'))
    assert(texts.every(includes('hello')))
  }

  {
    const response = await testIndex.functionScore({
      field_value_factor: {
        field: 'rating',
        factor: 1.2,
        modifier: 'sqrt',
        missing: 1,
      },
    })
    assert.strictEqual(response.status, 200)
    const data = await response.json()
    assert.strictEqual(data.hits.total.value, 3)
    assert.strictEqual(data.hits.hits.length, 3)
    const ratings = data.hits.hits.map(get('_source.rating'))
    assert.deepEqual(ratings, [...ratings].sort((a, b) => b - a)) // desc
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
