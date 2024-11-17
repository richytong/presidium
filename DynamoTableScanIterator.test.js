require('rubico/global')
const Transducer = require('rubico/Transducer')
const Test = require('thunk-test')
const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')
const DynamoTableScanIterator = require('./DynamoTableScanIterator')

const test = new Test('DynamoTableScanIterator', async function () {
  const testTable = new DynamoTable({
    name: 'test_table_scan_iterator',
    key: [{ id: 'string' }],
    endpoint: 'http://localhost:8000/',
    region: 'dynamodblocal',
  })
  await testTable.ready

  await testTable.putItem({ id: '1' })
  await testTable.putItem({ id: '2' })
  await testTable.putItem({ id: '3' })
  await testTable.putItem({ id: '4' })
  await testTable.putItem({ id: '5' })

  const items = await transform(
    DynamoTableScanIterator(testTable),
    Transducer.map(map(Dynamo.attributeValueToJSON)),
    [],
  )

  assert.equal(items.length, 5)

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
