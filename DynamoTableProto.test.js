require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTableProto')

const dynamo = Dynamo('http://localhost:8000/')

const test = new Test('DynamoTable', DynamoTable)

.before(async function () {
  this.dynamo = Dynamo({ endpoint: 'http://localhost:8000/' })
  await this.dynamo.deleteTable('test-tablename')
})

.case({
  name: 'test-tablename',
  endpoint: 'http://localhost:8000/',
  key: [{ id: 'string' }],
}, async function (testTable) {
  await testTable.ready
  // if we created another instance of testTable it shouldn't have to create now
  await new DynamoTable({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  }).ready

  console.log('ready')

  // .case('http://localhost:8000/', 'test-tablename', async function (testTable) {
  await testTable.putItem({ id: '1', name: 'john' })
  await testTable.putItem({ id: '2', name: 'henry' })
  await testTable.putItem({ id: { S: '3' }, name: { S: 'jude' } })
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
    { Item: map(Dynamo.AttributeValue)({ id: '1', name: 'john' }) })
  assert.rejects(
    testTable.getItem({ id: 'not-exists' }),
    {
      name: 'Error',
      message: 'Item not found for {"id":"not-exists"}',
      tableName: 'test-tablename',
    },
  )
  assert.deepEqual(
    await testTable.putItem({ id: '1', name: 'john' }, {
      ReturnValues: 'ALL_OLD',
      ReturnConsumedCapacity: 'TOTAL',
    }),
    {
      Attributes: map(Dynamo.AttributeValue)({ id: '1', name: 'john' }),
      ConsumedCapacity: { CapacityUnits: 1, TableName: 'test-tablename' },
    })

  assert.deepStrictEqual(
    await testTable.updateItem({ id: '1' }, {
      name: 'John III',
      isKing: true,
      ruleStart: 1820,
      ruleEnd: null,
    }, { ReturnValues: 'ALL_NEW' }),
    {
      Attributes: {
        id: { S: '1' },
        name: { S: 'John III' },
        isKing: { BOOL: true },
        ruleStart: { N: '1820' },
        ruleEnd: { NULL: true },
      },
    },
  )

  assert.rejects(
    testTable.updateItem({ id: 'not-exists' }, { a: 1 }, {
      ConditionExpression: 'attribute_exists(id)',
    }),
    {
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
      tableName: 'test-tablename',
    }
  )

  assert.deepEqual(
    await testTable.getItem({ id: '1' }),
    {
      Item: map(Dynamo.AttributeValue)({
        id: '1',
        name: 'John III',
        isKing: true,
        ruleStart: 1820,
        ruleEnd: null,
      })
    })

  {
    const data = await testTable.incrementItem(
      { id: '1' },
      { ruleStart: 1, newNumberField: 5, negativeNewNumberField: -1 },
      { ReturnValues: 'UPDATED_NEW' },
    )
    assert.deepEqual(data, {
      Attributes: {
        newNumberField: { N: '5' },
        negativeNewNumberField: { N: '-1' },
        ruleStart: { N: '1821' },
      }
    })
  }

  assert.deepEqual(
    await testTable.getItem({ id: '1' }),
    {
      Item: map(Dynamo.AttributeValue)({
        id: '1',
        name: 'John III',
        isKing: true,
        ruleStart: 1821,
        ruleEnd: null,
        newNumberField: 5,
        negativeNewNumberField: -1,
      })
    })

  assert.rejects(
    () => testTable.incrementItem(
      { id: '1' },
      { ruleEnd: 10 },
    ),
    {
      name: 'ValidationException',
      message: 'An operand in the update expression has an incorrect data type',
      tableName: 'test-tablename',
    },
  )

  assert.rejects(
    testTable.incrementItem({ id: 'not-exists' }, { a: 1 }, {
      ConditionExpression: 'attribute_exists(id)',
    }),
    {
      name: 'ConditionalCheckFailedException',
      message: 'The conditional request failed',
      tableName: 'test-tablename',
    }
  )

  {
    const scanResult1 = await testTable.scan({ limit: 1 })
    const scanResult2 = await testTable.scan({ limit: 2, exclusiveStartKey: scanResult1.LastEvaluatedKey })
    const scanResult3 = await testTable.scan({ exclusiveStartKey: scanResult2.LastEvaluatedKey })
    const bareScanResult = await testTable.scan()
    assert.strictEqual(scanResult1.Items.length, 1)
    assert.strictEqual(scanResult2.Items.length, 2)
    assert.strictEqual(scanResult3.Items.length, 0)
    assert.strictEqual(bareScanResult.Items.length, 3)
  }

  const res = await testTable.deleteItem({ id: '1' })
  assert.rejects(
    testTable.deleteItem({ somekey: 'a' }),
    {
      name: 'ValidationException',
      message: 'One of the required keys was not given a value',
      tableName: 'test-tablename',
    }
  )
  const shouldReject = testTable.getItem({ id: '1' })
  assert.rejects(
    () => shouldReject,
    new Error('Item not found for {"id":"1"}'))
  await shouldReject.catch(() => {})

  {
    const response = await testTable.delete()
    assert.deepEqual(response, {})
  }
})

.case({
  name: 'test-tablename',
  endpoint: 'http://localhost:8000/',
  key: [{ callSid: 'string' }, { ts: 'number' }],
}, async function (table) {
  await table.ready

  const callSid = 'a'

  await table.putItem({ callSid, ts: 1 })
  await table.putItem({ callSid, ts: 2 })
  await table.putItem({ callSid, ts: 3 })
  await table.putItem({ callSid, ts: 4 })

  {
    const calls = await table.query(
      'callSid = :callSid AND ts > :ts',
      { callSid, ts: 0 },
      { limit: 1000, scanIndexForward: true }, // ASC
    ).then(pipe([
      get('Items'),
      map(map(Dynamo.attributeValueToJSON)),
    ]))

    assert.equal(calls.length, 4)
    assert.equal(calls[0].ts, 1)
    assert.equal(calls[3].ts, 4)
  }

  {
    const calls = await table.query(
      'callSid = :callSid AND ts > :ts',
      { callSid, ts: 0 },
      { limit: 1000, scanIndexForward: false }, // DESC
    ).then(pipe([
      get('Items'),
      map(map(Dynamo.attributeValueToJSON)),
    ]))

    assert.equal(calls.length, 4)
    assert.equal(calls[0].ts, 4)
    assert.equal(calls[3].ts, 1)
  }
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
