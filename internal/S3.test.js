const assert = require('assert')
const Test = require('thunk-test')
const S3 = require('./S3')

const test = new Test('S3', (...args) => new S3(...args))
.case({
  endpoint: 'http://localhost:9000',
  accessKeyId: 'minioadmin',
  region: 'us-west-1',
  secretAccessKey: 'minioadmin',
}, s3 => {
  assert(typeof s3 == 'object')
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
