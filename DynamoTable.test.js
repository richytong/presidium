require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./internal/Dynamo')
const DynamoTable = require('./DynamoTable')

const test = new Test('DynamoTable', async () => {
  this.dynamo = new Dynamo({ endpoint: 'http://localhost:8000/' })
  await this.dynamo.deleteTable('test-tablename').catch(() => {})
  await this.dynamo.waitFor('test-tablename', 'tableNotExists')

  const testTable = new DynamoTable({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  })
  await testTable.ready.then(({ message }) => {
    assert.equal(message, 'created-table')
  })

  const testTable2 = new DynamoTable({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  })
  await testTable2.ready.then(({ message }) => {
    assert.equal(message, 'table-exists')
  })

  await testTable.putItem({ id: '1', name: 'john' })
  await testTable.putItem({ id: '2', name: 'henry' })
  await testTable.putItem({ id: '3', name: 'jude' })
  assert.rejects(
    testTable.putItem({ somekey: 'hey' }),
    {
      name: 'ValidationException',
      message: 'One of the required keys was not given a value',
      tableName: 'test-tablename',
    },
  )

  assert.deepEqual(
    await testTable.getItem({ id: '1' }),
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
    await testTable.getItemJSON({ id: '2' }),
    { id: '2', name: 'henry' },
  )

  assert.deepEqual(
    await testTable.getItemJSON({ id: { S: '2' } }),
    { id: '2', name: 'henry' },
  )

  await testTable.updateItem({ id: '2' }, { age: 36 }, {
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
    { id: '2', name: 'henry', age: 36 },
  )

  await assert.rejects(
    () => testTable.updateItem({ id: '2' }, { param: 'wont-be-set' }, {
      ConditionExpression: 'attribute_not_exists(age)',
    }),
    {
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
    },
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

  await testTable.incrementItem({ id: '2' }, { age: 1 })
  assert.deepEqual(
    await testTable.getItemJSON({ id: '2' }),
    { id: '2', name: 'henry', age: 37 },
  )

  await testTable.incrementItem({ id: '2' }, { age: 2 })
  assert.deepEqual(
    await testTable.getItemJSON({ id: '2' }),
    { id: '2', name: 'henry', age: 39 },
  )

  await testTable.deleteItem({ id: '2' })
  await assert.rejects(
    () => testTable.getItemJSON({ id: '2' }),
    new Error('Item not found for {"id":"2"}'),
  )

  await testTable.deleteItem({ id: { S: '4' } })
  await assert.rejects(
    () => testTable.getItemJSON({ id: '4' }),
    new Error('Item not found for {"id":"4"}'),
  )

  const userVersionTable = new DynamoTable({
    name: 'test-user-version-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }, { version: 'number' }],
  })
  await userVersionTable.ready

  await userVersionTable.putItem({
    id: '1',
    version: 0,
    createTime: 1,
  })
  await userVersionTable.putItem({
    id: '1',
    version: 1,
    createTime: 2,
  })
  await userVersionTable.putItem({
    id: '1',
    version: 2,
    createTime: 3,
  })
  await userVersionTable.putItem({
    id: '1',
    version: 3,
    createTime: 4,
  })

  await userVersionTable.query(
    'id = :id AND version > :version',
    { id: '1', version: 0 },
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

  await userVersionTable.query(
    'id = :id AND version > :version',
    { id: '1', version: 0 },
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
    { id: '1', version: 0, createTime: 2 },
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
    const iter = userVersionTable.queryIterator(
      'id = :id AND version > :version',
      { id: '1', version: 0 },
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
    const iter = userVersionTable.queryIterator(
      'id = :id AND version > :version',
      { id: '1', version: 0 },
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
    const iter = userVersionTable.queryIteratorJSON(
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
    const iter = userVersionTable.queryIteratorJSON(
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

  await testTable.delete()
  await userVersionTable.delete()
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
