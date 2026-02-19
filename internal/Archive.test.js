const assert = require('assert')
const stream = require('stream')
const fs = require('fs/promises')
const Test = require('thunk-test')
const Archive = require('./Archive')
const resolvePath = require('./resolvePath')
const map = require('rubico/map')
const reduce = require('rubico/reduce')
const Readable = require('../Readable')

const test = new Test('Archive', async function integration() {

  {
    const pack = await Archive.tar(__dirname, {
      ignore: ['Dockerfile', 'node_modules', '.git', '.nyc_output'],
    })
    const extracted = await Archive.untar(pack)
    assert(extracted.size > 0)
    for (const [path, entry] of extracted) {
      assert('header' in entry)
      assert(!path.startsWith('/'))
      assert.equal(typeof path, 'string')
      assert.equal(typeof entry[Symbol.asyncIterator], 'function')
      assert(entry.readable)
    }
  }

  {
    const base = {
      Dockerfile: 'FROM node:15-alpine'
    }
    const ignore = ['fixtures']
    const pack = await Archive.tar(__dirname, { ignore, base })
    const extracted = await Archive.untar(pack)
    const dir = await fs.readdir(__dirname)
      .then(filter(n => !ignore.includes(n)))
    const extractedKeys = [...extracted.keys()]
    assert.equal(extracted.size, dir.length + 1) // extra Dockerfile
    assert(extracted.has('Dockerfile'))
    assert.equal(
      await reduce(extracted.get('Dockerfile'), (a, b) => a + b, ''),
      'FROM node:15-alpine'
    )
  }

  {
    const base = {
      Dockerfile: 'FROM busybox:1.32',
      '.aws/credentials': '[presidium]\naccessKeyId\nsecretAccessKey',
    }
    const pack = await Archive.tar(`${__dirname}/`, {
      ignore: ['hashJSON.js'],
      base,
    })
    const extracted = await Archive.untar(pack)
    assert(extracted.size > 0)
    assert(extracted.has('Dockerfile'))
    assert(extracted.has('.aws/credentials'))
    assert.equal(
      await reduce(extracted.get('Dockerfile'), (a, b) => a + b, ''),
      'FROM busybox:1.32'
    )
  }

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
