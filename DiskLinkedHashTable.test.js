const Test = require('thunk-test')
const assert = require('assert')
const DiskLinkedHashTable = require('./DiskLinkedHashTable')

const test = new Test('DiskLinkedHashTable', async function integration() {
  const ht1024 = new DiskLinkedHashTable({
    filepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    length: 1024,
  })
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  await ht1024.set('maroon', '#800___', 3)
  assert.equal(await ht1024.get('maroon'), '#800___')

  const ht1 = new DiskLinkedHashTable({
    filepath: `${__dirname}/DiskLinkedHashTable_test_data/1`,
    length: 1,
  })
  await ht1.init()

  await ht1.set('maroon', '#800000', 1)
  await assert.rejects(
    ht1.set('yellow', '#FFFF00', 2),
    new Error('Hash table is full')
  )

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
