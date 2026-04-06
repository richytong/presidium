const Test = require('thunk-test')
const assert = require('assert')
const DiskHashTable = require('./DiskHashTable')

const test = new Test('DiskHashTable', async function integration() {

  const ht1024 = new DiskHashTable({
    filepath: `${__dirname}/DiskHashTable_test_data/1024`,
    length: 1024,
  })
  await ht1024.init()

  await ht1024.set('maroon', '#800000')
  await ht1024.set('yellow', '#FFFF00')

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  await ht1024.set('maroon', '#800___')
  assert.equal(await ht1024.get('maroon'), '#800___')

  const ht1 = new DiskHashTable({
    filepath: `${__dirname}/DiskHashTable_test_data/1`,
    length: 1,
  })
  await ht1.init()

  await ht1.set('maroon', '#800000')
  await assert.rejects(
    ht1.set('yellow', '#FFFF00'),
    new Error('Hash table is full')
  )

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
