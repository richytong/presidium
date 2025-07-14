require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./internal/Dynamo')
const DynamoDBTable = require('./DynamoDBTable')

const test = new Test('DynamoDBTable', async function integration() {
  {
    const testTable = new DynamoDBTable({
      name: 'test-tablename',
      endpoint: 'http://localhost:8000/',
      key: [{ id: 'string' }],
      autoReady: false
    })
    await testTable.delete().catch(() => {})
    await testTable.waitForNotExists()
  }

  const testTable = new DynamoDBTable({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  })
  await testTable.ready.then(({ message }) => {
    assert.equal(message, 'created-table')
  })

  const testTable2 = new DynamoDBTable({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  })
  await testTable2.ready.then(({ message }) => {
    assert.equal(message, 'table-exists')
  })

  await testTable.putItem({ id: { S: '1' }, name: { S: 'john' } })
  await testTable.putItemJSON({ id: '2', name: 'henry' })
  assert.deepEqual(
    await testTable.putItemJSON({ id: '3', name: 'jude' }, {
      ReturnValues: 'ALL_OLD',
    }),
    {}
  )

  await assert.rejects(
    testTable.putItem({ somekey: { S: 'hey' } }),
    {
      name: 'ValidationException',
      message: 'One of the required keys was not given a value',
    }
  )

  await assert.rejects(
    testTable.putItemJSON({ somekey: 'hey' }),
    {
      name: 'ValidationException',
      message: 'One of the required keys was not given a value',
    }
  )

  assert.deepEqual(
    await testTable.getItem({ id: { S: '1' } }),
    {
      Item: {
        id: { S: '1' },
        name: { S: 'john' }
      },
    },
  )

  assert.deepEqual(
    await testTable.getItem({ id: { S: '3' } }),
    {
      Item: {
        id: { S: '3' },
        name: { S: 'jude' }
      },
    },
  )

  assert.deepEqual(
    await testTable.getItemJSON({ id: '1' }),
    { item: { id: '1', name: 'john' } },
  )

  assert.deepEqual(
    await testTable.getItemJSON({ id: '2' }),
    { item: { id: '2', name: 'henry' } },
  )

  await testTable.updateItem({ id: { S: '2' } }, { age: { N: 36 } }, {
    ReturnConsumedCapacity: 'TOTAL',
    ReturnItemCollectionMetrics: 'SIZE',
    ReturnValues: 'ALL_NEW',
  }).then(res => {
    assert.deepEqual(res.Attributes, {
      id: { S: '2' },
      name: { S: 'henry' },
      age: { N: '36' },
    })
    assert.equal(res.ConsumedCapacity.CapacityUnits, 1)
  })

  assert.deepEqual(
    await testTable.getItemJSON({ id: '2' }),
    { item: { id: '2', name: 'henry', age: 36 } },
  )

  await testTable.updateItemJSON({ id: '2' }, { age: 36 }, {
    ReturnConsumedCapacity: 'TOTAL',
    ReturnItemCollectionMetrics: 'SIZE',
    ReturnValues: 'ALL_NEW',
  }).then(res => {
    assert.deepEqual(res.attributes, {
      id: '2',
      name: 'henry',
      age: '36',
    })
    assert.equal(res.ConsumedCapacity.CapacityUnits, 1)
  })

  await assert.rejects(
    () => testTable.updateItem({ id: { S: '2' } }, { param: { S: 'wont-be-set' } }, {
      ConditionExpression: 'attribute_not_exists(age)',
    }),
    {
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
    }
  )

  await assert.rejects(
    () => testTable.updateItemJSON({ id: '2' }, { param: 'wont-be-set' }, {
      ConditionExpression: 'attribute_not_exists(age)',
    }),
    {
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
    }
  )

  await testTable.scan().then(res => {
    assert.equal(res.Items.length, 3)
    assert.equal(res.Count, 3)
  })

  {
    const iter = await testTable.scanIterator()
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
  }

  {
    const iter = await testTable.scanIterator({ BatchLimit: 1 })
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
  }

  {
    const iter = await testTable.scanIteratorJSON()
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
  }

  {
    const iter = await testTable.scanIteratorJSON({ BatchLimit: 1 })
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
  }

  assert.deepEqual(
    await testTable.incrementItem({ id: { S: '2' } }, { age: { N: 1 } }, {
      ReturnValues: 'ALL_NEW',
    }),
    {
      Attributes: {
        id: { S: '2' },
        name: { S: 'henry' },
        age: { N: 37 }
      }
    }
  )

  assert.deepEqual(
    await testTable.incrementItemJSON({ id: '2' }, { age: 2 }, {
      ReturnValues: 'ALL_NEW',
    }),
    {
      attributes: {
        id: '2',
        name: 'henry',
        age: 39
      }
    }
  )

  assert.deepEqual(
    await testTable.getItemJSON({ id: '2' }),
    { item: { id: '2', name: 'henry', age: 39 } },
  )

  assert.deepEqual(
    await testTable.deleteItemJSON({ id: '2' }, {
      ReturnValues: 'ALL_OLD',
    }),
    {
      attributes: {
        id: '2',
        name: 'henry',
        age: 39
      }
    }
  )

  await assert.rejects(
    () => testTable.getItemJSON({ id: '2' }),
    new Error('Item not found for {"id":"2"}'),
  )

  await testTable.deleteItem({ id: { S: '4' } })
  await assert.rejects(
    () => testTable.getItemJSON({ id: '4' }),
    new Error('Item not found for {"id":"4"}'),
  )

  const userVersionTable = new DynamoDBTable({
    name: 'test-user-version-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }, { version: 'number' }],
  })
  await userVersionTable.ready

  await userVersionTable.putItemJSON({
    id: '1',
    version: 0,
    createTime: 1,
  })
  await userVersionTable.putItemJSON({
    id: '1',
    version: 1,
    createTime: 2,
  })
  await userVersionTable.putItemJSON({
    id: '1',
    version: 2,
    createTime: 3,
  })
  await userVersionTable.putItemJSON({
    id: '1',
    version: 3,
    createTime: 4,
  })

  await userVersionTable.query(
    'id = :id AND version > :version',
    { id: { S: '1' }, version: { N: '0' } },
    { ScanIndexForward: true, ConsistentRead: true },
  ).then(res => {
    assert.equal(res.Items.length, 3)
    assert.equal(res.Count, 3)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.equal(res.Items[0].version.N, '1')
    assert.equal(res.Items[1].version.N, '2')
    assert.equal(res.Items[2].version.N, '3')
  })

  await userVersionTable.queryJSON(
    'id = :id AND version > :version',
    { id: '1', version: 0 },
    { ScanIndexForward: true, ConsistentRead: true },
  ).then(res => {
    assert.equal(res.items.length, 3)
    assert.equal(res.Count, 3)
    for (const item of res.items) {
      assert(!Dynamo.isDynamoDBJSON(item))
    }
    assert.equal(res.items[0].version, 1)
    assert.equal(res.items[1].version, 2)
    assert.equal(res.items[2].version, 3)
  })

  await userVersionTable.query(
    'id = :id AND version > :version',
    { id: { S: '1' }, version: { N: '0' } },
    { ScanIndexForward: true, ProjectionExpression: 'id,createTime' },
  ).then(res => {
    assert.equal(res.Items.length, 3)
    assert.equal(res.Count, 3)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.deepEqual(res.Items[0], { id: { S: '1' }, createTime: { N: '2' } })
    assert.deepEqual(res.Items[1], { id: { S: '1' }, createTime: { N: '3' } })
    assert.deepEqual(res.Items[2], { id: { S: '1' }, createTime: { N: '4' } })
  })

  await userVersionTable.query(
    'id = :id AND version > :version',
    { id: { S: '1' }, version: { N: '0' }, createTime: { N: '2' } },
    {
      ScanIndexForward: true,
      FilterExpression: 'createTime > :createTime',
    },
  ).then(res => {
    assert.equal(res.Items.length, 2)
    assert.equal(res.Count, 2)
    assert.equal(res.ScannedCount, 3)
    for (const item of res.Items) {
      assert(Dynamo.isDynamoDBJSON(item))
    }
    assert.equal(res.Items[0].createTime.N, '3')
    assert.equal(res.Items[1].createTime.N, '4')
  })

  {
    const iter = userVersionTable.queryItemsIterator(
      'id = :id AND version > :version',
      { id: { S: '1' }, version: { N: '0' } },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
    assert.equal(items[0].version.N, '1')
    assert.equal(items[1].version.N, '2')
    assert.equal(items[2].version.N, '3')
  }

  {
    const iter = userVersionTable.queryItemsIteratorJSON(
      'id = :id AND version > :version',
      { id: '1', version: 0 },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
    assert.equal(items[0].version, 1)
    assert.equal(items[1].version, 2)
    assert.equal(items[2].version, 3)
  }

  {
    const iter = userVersionTable.queryItemsIterator(
      'id = :id AND version > :version',
      { id: { S: '1' }, version: { N: '0' } },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 2)
    assert.equal(items[0].version.N, '3')
    assert.equal(items[1].version.N, '2')
  }

  {
    const iter = userVersionTable.queryItemsIteratorJSON(
      'id = :id AND version > :version',
      { id: '1', version: 0 },
      { ScanIndexForward: true, BatchLimit: 1 },
    )
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 3)
    assert.equal(items[0].version, 1)
    assert.equal(items[1].version, 2)
    assert.equal(items[2].version, 3)
  }

  {
    const iter = userVersionTable.queryItemsIteratorJSON(
      'id = :id AND version > :version',
      { id: '1', version: 0 },
      { ScanIndexForward: false, BatchLimit: 1, Limit: 2 },
    )
    const items = []
    for await (const item of iter) {
      assert(!Dynamo.isDynamoDBJSON(item))
      items.push(item)
    }
    assert.equal(items.length, 2)
    assert.equal(items[0].version, 3)
    assert.equal(items[1].version, 2)
  }

  testTable.closeConnections()
  userVersionTable.closeConnections()
  await testTable.delete()
  await testTable.waitForNotExists()
  await userVersionTable.delete()
  await userVersionTable.waitForNotExists()
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
