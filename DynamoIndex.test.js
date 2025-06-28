require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./internal/Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')

const test = new Test('DynamoIndex', async () => {
  this.dynamo = new Dynamo({
    endpoint: 'http://localhost:8000/',
    region: 'default-region',
  })
  await this.dynamo.deleteTable('test-tablename').catch(() => {})
  await this.dynamo.waitFor('test-tablename', 'tableNotExists')

  const testTable = new DynamoTable({
    name: 'test-tablename',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000/',
  })
  await testTable.ready.then(({ message }) => {
    assert.equal(message, 'created-table')
  })

  const testIndex = new DynamoIndex({
    table: 'test-tablename',
    key: [{ type: 'string' }, { time: 'number' }],
    endpoint: 'http://localhost:8000/',
  })
  await testIndex.ready.then(({ message }) => {
    assert.equal(message, 'created-index')
  })

  const testIndex2 = new DynamoIndex({
    table: 'test-tablename',
    key: [{ type: 'string' }, { time: 'number' }],
    endpoint: 'http://localhost:8000/',
  })
  await testIndex2.ready.then(({ message }) => {
    assert.equal(message, 'index-exists')
  })

  await testTable.putItem({ id: '0', type: 'page_view', time: 0, a: 0 })
  await testTable.putItem({ id: '1', type: 'page_view', time: 1, a: 1 })
  await testTable.putItem({ id: '2', type: 'page_view', time: 2, a: 2 })
  await testTable.putItem({ id: '3', type: 'page_view', time: 3, a: 3 })
  await testTable.putItem({ id: '4', type: 'page_view', time: 4, a: 4 })
  await testTable.putItem({ id: '5', type: 'page_view', time: 5, a: 5 })

  await testIndex.query(
    'type = :type AND time > :time',
    { type: 'page_view', time: 0 },
    { ScanIndexForward: true },
  ).then(res => {
    assert.equal(res.Items.length, 5)
    assert.equal(res.Count, 5)
    assert.equal(res.ScannedCount, 5)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.equal(res.Items[0].time.N, '1')
    assert.equal(res.Items[1].time.N, '2')
    assert.equal(res.Items[2].time.N, '3')
    assert.equal(res.Items[3].time.N, '4')
    assert.equal(res.Items[4].time.N, '5')
  })

  await testIndex.query(
    'type = :type AND time > :time',
    { type: 'page_view', time: 0 },
    {
      ScanIndexForward: false,
      ProjectionExpression: 'id,time'
    },
  ).then(res => {
    assert.equal(res.Items.length, 5)
    assert.equal(res.Count, 5)
    assert.equal(res.ScannedCount, 5)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.deepEqual(res.Items[4], { id: { S: '1' }, time: { N: '1' } })
    assert.deepEqual(res.Items[3], { id: { S: '2' }, time: { N: '2' } })
    assert.deepEqual(res.Items[2], { id: { S: '3' }, time: { N: '3' } })
    assert.deepEqual(res.Items[1], { id: { S: '4' }, time: { N: '4' } })
    assert.deepEqual(res.Items[0], { id: { S: '5' }, time: { N: '5' } })
  })

  await testIndex.query(
    'type = :type AND time > :time',
    { type: 'page_view', time: 0, a: 4 },
    {
      ScanIndexForward: true,
      FilterExpression: 'a > :a',
    },
  ).then(res => {
    assert.equal(res.Items.length, 1)
    assert.equal(res.Count, 1)
    assert.equal(res.ScannedCount, 5)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.equal(res.Items[0].id.S, '5')
  })

  {
    const iter = testIndex.queryIterator(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 5)
    assert.equal(items[0].id.S, '1')
    assert.equal(items[1].id.S, '2')
    assert.equal(items[2].id.S, '3')
    assert.equal(items[3].id.S, '4')
    assert.equal(items[4].id.S, '5')
  }

  {
    const iter = testIndex.queryIterator(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 2)
    assert.equal(items[0].id.S, '5')
    assert.equal(items[1].id.S, '4')
  }

  {
    const iter = testIndex.queryIteratorJSON(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 5)
    assert.equal(items[0].id, '1')
    assert.equal(items[1].id, '2')
    assert.equal(items[2].id, '3')
    assert.equal(items[3].id, '4')
    assert.equal(items[4].id, '5')
  }

  {
    const iter = testIndex.queryIteratorJSON(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 2)
    assert.equal(items[0].id, '5')
    assert.equal(items[1].id, '4')
  }

  await testTable.delete()
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
