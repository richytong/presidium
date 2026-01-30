const Test = require('thunk-test')
const assert = require('assert')
const WebSocket = require('./WebSocket')

const test = new Test('WebSocket', async function integration() {
  assert.equal(typeof WebSocket, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
