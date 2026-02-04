const Test = require('thunk-test')
const assert = require('assert')
const WebSocketServer = require('./WebSocketServer')

const test = new Test('WebSocketServer', async function integration() {
  assert.equal(typeof WebSocketServer, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
