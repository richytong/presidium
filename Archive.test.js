const assert = require('assert')
const Test = require('thunk-test')
const Archive = require('./Archive')
const pathResolve = require('./internal/pathResolve')
const map = require('rubico/map')
const reduce = require('rubico/reduce')

module.exports = Test('Archive', Archive)
  .case({}, {
    ignore: ['Dockerfile', 'node_modules', '.git', '.nyc_output'],
  }, async archive => {
    const pack = await archive.tar(pathResolve(__dirname, 'internal'))
    const extracted = await archive.untar(pack)
    assert(extracted.size > 0)
    for (const [path, stream] of extracted) {
      assert('header' in stream)
      assert(!path.startsWith('/'))
      assert.equal(typeof path, 'string')
      assert.equal(typeof stream[Symbol.asyncIterator], 'function')
    }
  })
  .case({
    Dockerfile: 'FROM node:15-alpine'
  }, async archive => {
    const pack = await archive.tar(pathResolve(__dirname, 'internal'))
    const extracted = await archive.untar(pack)
    assert(extracted.size > 0)
    assert(extracted.has('Dockerfile'))
    assert.equal(
      await reduce((a, b) => a + b, '')(extracted.get('Dockerfile')),
      'FROM node:15-alpine')
  })
