const Test = require('thunk-test')
const assert = require('assert')
const package = require('./package.json')
const index = require('.')

const test = new Test('index.test', async function integration() {
  assert.equal(Object.keys(index).length, 34)

  for (const name in index) {
    assert(package.files.includes(`${name}.js`))
    if (typeof index[name] == "object") {
      assert.equal(require(`./${name}`).name, name)
    }
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
