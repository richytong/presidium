require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const sleep = require('./internal/sleep')
const AwsCredentials = require('./AwsCredentials')
const isDynamoDBJSON = require('./internal/isDynamoDBJSON')
const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBGlobalSecondaryIndex = require('./DynamoDBGlobalSecondaryIndex')

const test = new Test('DynamoDBGlobalSecondaryIndex', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  const testTablename = `test-tablename-1-${Date.now()}`

  {
    const testTable = new DynamoDBTable({
      name: testTablename,
      key: [{ id: 'string' }],
      ...awsCreds,
      autoReady: false
    })

    let resourceInUse = await testTable.delete().catch(error => {
      if (error.name == 'ResourceInUseException') {
        return true
      }
      if (error.name == 'ResourceNotFoundException') {
        return false
      }
      throw error
    })
    while (resourceInUse) {
      await sleep(100)
      resourceInUse = await testTable.delete().catch(error => {
        if (error.name == 'ResourceInUseException') {
          return true
        }
        if (error.name == 'ResourceNotFoundException') {
          return false
        }
        throw error
      })
    }
    await testTable.waitForNotExists()
  }

  const testTable = new DynamoDBTable({
    name: testTablename,
    key: [{ id: 'string' }],
    ...awsCreds,
  })
  await testTable.ready.then(({ message }) => {
    assert.equal(message, 'created-table')
  })

  const testIndex = new DynamoDBGlobalSecondaryIndex({
    table: testTablename,
    key: [{ type: 'string' }, { time: 'number' }],
    ...awsCreds,
  })
  await testIndex.ready.then(({ message }) => {
    assert.equal(message, 'created-global-secondary-index')
  })

  const testIndex2 = new DynamoDBGlobalSecondaryIndex({
    table: testTablename,
    key: [{ type: 'string' }, { time: 'number' }],
    ...awsCreds,
  })
  await testIndex2.ready.then(({ message }) => {
    assert.equal(message, 'global-secondary-index-exists')
  })

  await testTable.putItemJSON({ id: '0', type: 'page_view', time: 0, a: 0 })
  await testTable.putItemJSON({ id: '1', type: 'page_view', time: 1, a: 1 })
  await testTable.putItemJSON({ id: '2', type: 'page_view', time: 2, a: 2 })
  await testTable.putItemJSON({ id: '3', type: 'page_view', time: 3, a: 3 })
  await testTable.putItemJSON({ id: '4', type: 'page_view', time: 4, a: 4 })
  await testTable.putItemJSON({ id: '5', type: 'page_view', time: 5, a: 5 })

  let maximumTimeToWaitForEventualConsistency = 60000
  while (true) {
    const data = await testTable.scan()
    if (data.Items.length == 6) {
      break
    }
    await sleep(100)
    maximumTimeToWaitForEventualConsistency -= 100
    if (maximumTimeToWaitForEventualConsistency <= 0) {
      throw new Error('Unexpected count of table items.')
    }
  }

  await testIndex.query(
    'type = :type AND time > :time',
    { type: { S: 'page_view' }, time: { N: 0 } },
    { ScanIndexForward: true },
  ).then(data => {
    assert.equal(data.Items.length, 5)
    assert.equal(data.Count, 5)
    assert.equal(data.ScannedCount, 5)
    for (const item of data.Items) {
      assert(isDynamoDBJSON(item))
    }

    assert.equal(data.Items[0].time.N, '1')
    assert.equal(data.Items[1].time.N, '2')
    assert.equal(data.Items[2].time.N, '3')
    assert.equal(data.Items[3].time.N, '4')
    assert.equal(data.Items[4].time.N, '5')

    assert.equal(data.Items[0].id.S, '1')
    assert.equal(data.Items[1].id.S, '2')
    assert.equal(data.Items[2].id.S, '3')
    assert.equal(data.Items[3].id.S, '4')
    assert.equal(data.Items[4].id.S, '5')
  })

  await testIndex.queryJSON(
    'type = :type AND time > :time',
    { type: 'page_view', time: 0 },
    {
      ScanIndexForward: false,
      ProjectionExpression: 'id,time'
    },
  ).then(data => {
    assert.equal(data.ItemsJSON.length, 5)
    assert.equal(data.Count, 5)
    assert.equal(data.ScannedCount, 5)
    for (const item of data.ItemsJSON) {
      assert(!isDynamoDBJSON(item))
    }

    assert.deepEqual(data.ItemsJSON[4], { id: '1', time: 1 })
    assert.deepEqual(data.ItemsJSON[3], { id: '2', time: 2 })
    assert.deepEqual(data.ItemsJSON[2], { id: '3', time: 3 })
    assert.deepEqual(data.ItemsJSON[1], { id: '4', time: 4 })
    assert.deepEqual(data.ItemsJSON[0], { id: '5', time: 5 })
  })

  await testIndex.queryJSON(
    'type = :type AND time > :time',
    { type: 'page_view', time: 0, a: 4 },
    {
      ScanIndexForward: true,
      FilterExpression: 'a > :a',
    },
  ).then(data => {
    assert.equal(data.ItemsJSON.length, 1)
    assert.equal(data.Count, 1)
    assert.equal(data.ScannedCount, 5)
    for (const item of data.ItemsJSON) {
      assert(!isDynamoDBJSON(item))
    }
    assert.equal(data.ItemsJSON[0].id, '5')
  })

  {
    const iter = testIndex.queryItemsIterator(
      'type = :type AND time > :time',
      { type: { S: 'page_view' }, time: { N: 0 } },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(isDynamoDBJSON(item))
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
    const iter = testIndex.queryItemsIterator(
      'type = :type AND time > :time',
      { type: { S: 'page_view' }, time: { N: 0 } },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 2)
    assert.equal(items[0].id.S, '5')
    assert.equal(items[1].id.S, '4')
  }

  {
    const iter = testIndex.queryItemsIteratorJSON(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(!isDynamoDBJSON(item))
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
    const iter = testIndex.queryItemsIteratorJSON(
      'type = :type AND time > :time',
      { type: 'page_view', time: 0 },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(!isDynamoDBJSON(item))
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
