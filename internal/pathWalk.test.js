const assert = require('assert')
const Test = require('thunk-test')
const pathWalk = require('./pathWalk')
const resolvePath = require('./resolvePath')

const test = Test('pathWalk', pathWalk)

.case(__dirname, function (paths) {
  assert(paths.length > 0)
  this.allInternalPaths = paths
})

.case(__dirname, { ignore: ['pathWalk.js'] }, function (paths) {
  assert.equal(paths.length, this.allInternalPaths.length - 1)
})

.case(__dirname, { ignore: [resolvePath(__dirname, 'pathWalk.js')] }, function (paths) {
  assert.equal(paths.length, this.allInternalPaths.length - 1)
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
