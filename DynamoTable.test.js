const Test = require('thunk-test')
const map = require('rubico/map')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')

const dynamo = Dynamo('http://localhost:8000/')

module.exports = Test('DynamoTable', DynamoTable)
  .before(async function () {
    this.dynamo = Dynamo({ endpoint: 'http://localhost:8000/' })
    await this.dynamo.deleteTable('test-tablename')
  })
  .case({
    name: 'test-tablename',
    endpoint: 'http://localhost:8000/',
    key: [{ id: 'string' }],
  }, async function (testTable) {
    // .case('http://localhost:8000/', 'test-tablename', async function (testTable) {
    await testTable.putItem({ id: '1', name: 'george' })
    await testTable.putItem({ id: '2', name: 'henry' })
    await testTable.putItem({ id: '3', name: 'jude' })
    assert.deepEqual(
      await testTable.getItem({ id: '1' }),
      { Item: map(Dynamo.AttributeValue)({ id: '1', name: 'george' }) })
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
      const scanResult1 = await testTable.scan({ limit: 1 })
      const scanResult2 = await testTable.scan({ limit: 2, exclusiveStartKey: scanResult1.LastEvaluatedKey })
      const scanResult3 = await testTable.scan({ limit: 2, exclusiveStartKey: scanResult2.LastEvaluatedKey })
      assert.strictEqual(scanResult1.Items.length, 1)
      assert.strictEqual(scanResult2.Items.length, 2)
      assert.strictEqual(scanResult3.Items.length, 0)
    }

    await testTable.deleteItem({ id: '1' })
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
