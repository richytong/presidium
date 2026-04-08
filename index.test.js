const Test = require('thunk-test')
const assert = require('assert')
const package = require('./package.json')
const index = require('.')

const test = new Test('index.test', async function integration() {
  assert.equal(Object.keys(index).length, 26)

  for (const name in index) {
    assert(package.files.includes(`${name}.js`))
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
