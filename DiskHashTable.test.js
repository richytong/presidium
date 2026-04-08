const Test = require('thunk-test')
const assert = require('assert')
const DiskHashTable = require('./DiskHashTable')

const test = new Test('DiskHashTable', async function integration() {
  assert.equal(typeof DiskHashTable, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
