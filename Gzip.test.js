const Test = require('thunk-test')
const assert = require('assert')
const zlib = require('zlib')
const Gzip = require('./Gzip')
const StreamString = require('./internal/StreamString')
const StringStream = require('./internal/StringStream')

const test = new Test('Gzip', async function () {
  const raw = 'aaaaabbbbbbbcccc'

  {
    const transformed = await StreamString(
      Gzip(raw).pipe(zlib.createGunzip())
    )
    assert.equal(raw, transformed)
  }

  {
    const transformed = await StreamString(
      StringStream(raw).pipe(Gzip()).pipe(zlib.createGunzip())
    )
    assert.equal(raw, transformed)
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
