const Test = require('thunk-test')
const assert = require('assert')
const ServerWebSocket = require('./ServerWebSocket')

const test = new Test('ServerWebSocket', async function integration() {
  assert.equal(typeof ServerWebSocket, 'function')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
