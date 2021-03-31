const assert = require('assert')
const Test = require('thunk-test')
const RequestBuffer = require('./RequestBuffer')
const { Readable } = require('stream')

const test = new Test('RequestBuffer', async function() {
  const readable = Readable.from((async function* () {
    yield '11'; yield '22'; yield '33'; yield '44'; yield '55'
  })())
  const buffer = await RequestBuffer(readable)
  assert.strictEqual(buffer.toString('utf8'), '\x0B\x16!,7')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
