const Test = require('thunk-test')
const assert = require('assert')
const WebSocketSecureServer = require('./WebSocketSecureServer')

const test = new Test('WebSocketSecureServer', async function integration() {
  assert.equal(typeof WebSocketSecureServer, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
