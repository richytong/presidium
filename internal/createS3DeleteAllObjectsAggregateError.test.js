const Test = require('thunk-test')
const createS3DeleteAllObjectsAggregateError = require('./createS3DeleteAllObjectsAggregateError')

const test = new Test('createS3DeleteAllObjectsAggregateError', createS3DeleteAllObjectsAggregateError)

function createError(name, message) {
  const error = new Error(message)
  error.name = name
  return error
}

test.case([
  {
    Key: 'testkey1',
    Code: 'AccessDenied',
    Message: 'Access Denied',
  },
  {
    Key: 'testkey1',
    Code: 'AllAccessDisabled',
    Message: 'All access to this Amazon S3 resource has been disabled. Contact AWS Support for further assistance.',
  },
], new AggregateError([
  createError('AccessDenied', 'testkey1: Access Denied'),
  createError('AllAccessDisabled', 'testkey1: All access to this Amazon S3 resource has been disabled. Contact AWS Support for further assistance.'),
]))

test.case([
  {
    Key: 'testkey1',
    VersionId: '1',
    Code: 'AccessDenied',
    Message: 'Access Denied',
  },
  {
    Key: 'testkey1',
    VersionId: '1',
    Code: 'AllAccessDisabled',
    Message: 'All access to this Amazon S3 resource has been disabled. Contact AWS Support for further assistance.',
  },
], new AggregateError([
  createError('AccessDenied', 'testkey1/1: Access Denied'),
  createError('AllAccessDisabled', 'testkey1/1: All access to this Amazon S3 resource has been disabled. Contact AWS Support for further assistance.'),
]))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
