const assert = require('assert')
const fs = require('fs/promises')
const Test = require('thunk-test')
const Archive = require('./Archive')
const resolvePath = require('./internal/resolvePath')
const map = require('rubico/map')
const reduce = require('rubico/reduce')

const test = new Test('Archive', (...args) => new Archive(...args))

.case(async archive => {
  const pack = await archive.tar(resolvePath(__dirname), {
    ignore: ['Dockerfile', 'node_modules', '.git', '.nyc_output'],
  })
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
  const ignore = ['fixtures']
  const pack = await archive.tar(resolvePath(__dirname, 'internal'), { ignore })
  const extracted = await archive.untar(pack)
  const dir = await fs.readdir(resolvePath(__dirname, 'internal'))
    .then(filter(n => !ignore.includes(n)))
  const extractedKeys = [...extracted.keys()]
  assert.equal(extracted.size, dir.length + 1) // extra Dockerfile
  assert(extracted.has('Dockerfile'))
  assert.equal(
    await reduce((a, b) => a + b, '')(extracted.get('Dockerfile')),
    'FROM node:15-alpine')
})

.case({
  Dockerfile: 'FROM busybox:1.32',
  '.aws/credentials': '[claimyr]\naccessKeyId\nsecretAccessKey',
}, async archive => {
  const pack = await archive.tar(`${resolvePath(__dirname, 'internal')}/`, {
    ignore: ['hashJSON.js'],
  })
  const extracted = await archive.untar(pack)
  assert(extracted.size > 0)
  assert(extracted.has('Dockerfile'))
  assert(extracted.has('.aws/credentials'))
  assert.equal(
    await reduce((a, b) => a + b, '')(extracted.get('Dockerfile')),
    'FROM busybox:1.32')
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
