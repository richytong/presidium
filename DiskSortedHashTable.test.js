const Test = require('thunk-test')
const assert = require('assert')
const DiskSortedHashTable = require('./DiskSortedHashTable')

const test = new Test('DiskSortedHashTable', async function integration() {
  assert.equal(typeof DiskSortedHashTable, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
