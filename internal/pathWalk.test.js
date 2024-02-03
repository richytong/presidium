const assert = require('assert')
const Test = require('thunk-test')
const pathWalk = require('./pathWalk')
const pathResolve = require('./pathResolve')

const test = Test('pathWalk', pathWalk)

.case(__dirname, function (paths) {
  assert(paths.length > 0)
  this.allInternalPaths = paths
})

.case(__dirname, { ignore: ['pathWalk.js'] }, function (paths) {
  assert.equal(paths.length, this.allInternalPaths.length - 1)
})

.case(__dirname, { ignore: [pathResolve(__dirname, 'pathWalk.js')] }, function (paths) {
  assert.equal(paths.length, this.allInternalPaths.length - 1)
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
