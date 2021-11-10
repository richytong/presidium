const Test = require('thunk-test')
const map = require('rubico/map')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')

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

    // .case('http://localhost:8000/', 'test-tablename', async function (testTable) {
    await testTable.putItem({ id: '1', name: 'george' })
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
      { Item: map(Dynamo.AttributeValue)({ id: '1', name: 'george' }) })
    assert.rejects(
      testTable.getItem({ id: 'not-exists' }),
      {
        name: 'Error',
        message: 'Item not found for {"id":"not-exists"}',
        tableName: 'test-tablename',
      },
    )
    assert.deepEqual(
      await testTable.putItem({ id: '1', name: 'george' }, {
        ReturnValues: 'ALL_OLD',
        ReturnConsumedCapacity: 'TOTAL',
      }),
      {
        Attributes: map(Dynamo.AttributeValue)({ id: '1', name: 'george' }),
        ConsumedCapacity: { CapacityUnits: 1, TableName: 'test-tablename' },
      })

    assert.deepStrictEqual(
      await testTable.updateItem({ id: '1' }, {
        name: 'George III',
        isKing: true,
        ruleStart: 1820,
        ruleEnd: null,
      }, { ReturnValues: 'ALL_NEW' }),
      {
        Attributes: {
          id: { S: '1' },
          name: { S: 'George III' },
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
          name: 'George III',
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
          name: 'George III',
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

      assert.rejects(
        testTable.scan({ forceTableName: 'nonexistent-table-name' }),
        {
          name: 'ResourceNotFoundException',
          message: 'Cannot do operations on a non-existent table',
          tableName: 'test-tablename',
        },
      )
    }

    await testTable.deleteItem({ id: '1' })
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

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
