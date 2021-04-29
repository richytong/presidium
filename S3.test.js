const assert = require('assert')
const Test = require('thunk-test')
const S3 = require('./S3')

module.exports = Test('S3', S3)
.case({
  endpoint: 'http://localhost:9000',
  accessKeyId: 'minioadmin',
  region: 'us-west-1',
  secretAccessKey: 'minioadmin',
}, s3 => {
  assert(typeof s3 == 'object')
})
