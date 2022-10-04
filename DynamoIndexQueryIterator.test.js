require('rubico/global')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')
const DynamoIndexQueryIterator = require('./DynamoIndexQueryIterator')

const test = new Test('DynamoIndexQueryIterator', async function () {
  const testTable = new DynamoTable({
    name: 'test_table',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000/',
    region: 'dynamodblocal',
  })
  await testTable.ready

  const testStatusCreateTimeIndex = new DynamoIndex({
    table: 'test_table',
    key: [{ status: 'string' }, { createTime: 'number' }],
    endpoint: 'http://localhost:8000/',
    region: 'dynamodblocal',
  })
  await testStatusCreateTimeIndex.ready

  {
    let number = -1
    while (++number < 50) {
      await testTable.putItem({
        id: number.toString(),
        status: 'pending',
        createTime: number + 1,
      })
    }
  }

  {
    const array = []
    const iter = DynamoIndexQueryIterator(
      testStatusCreateTimeIndex,
      'status = :status AND createTime > :createTime',
      { status: 'pending', createTime: 0 },
      { limit: 10, scanIndexForward: true },
    )
    for await (const item of iter) {
      array.push(map(item, Dynamo.attributeValueToJSON))
    }
    assert.equal(array.length, 50)
    assert.equal(array[0].id, '0')
  }

  {
    const array = []
    const iter = DynamoIndexQueryIterator(
      testStatusCreateTimeIndex,
      'status = :status AND createTime > :createTime',
      { status: 'pending', createTime: 0 },
      { limit: 10, scanIndexForward: false },
    )
    for await (const item of iter) {
      array.push(map(item, Dynamo.attributeValueToJSON))
    }
    assert.equal(array.length, 50)
    assert.equal(array[0].id, '49')
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
