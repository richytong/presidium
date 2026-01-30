const assert = require('assert')
const createS3DeleteObjectError = require('./createS3DeleteObjectError')

describe('createS3DeleteObjectError', () => {
  it('creates an AwsError from ErrorData sent from s3 deleteObject', async  () => {
    const error = createS3DeleteObjectError({
      Key: 'a',
      VersionId: 'v1',
      Code: 'CustomError',
      Message: 'Message 1',
    })
    assert.equal(error.name, 'CustomError')
    assert.equal(error.message, 'Message 1')
    assert.equal(error.Key, 'a')
    assert.equal(error.VersionId, 'v1')

    const error2 = createS3DeleteObjectError({
      Key: 'b',
      VersionId: 'v2',
      Message: 'Message 2',
    })
    assert.equal(error2.name, 'AwsError')
    assert.equal(error2.message, 'Message 2')
    assert.equal(error2.Key, 'b')
    assert.equal(error2.VersionId, 'v2')

    const error3 = createS3DeleteObjectError({
      Code: 'CustomError3',
      Key: 'c',
      Message: 'Message 3',
    })
    assert.equal(error3.name, 'CustomError3')
    assert.equal(error3.message, 'Message 3')
    assert.equal(error3.Key, 'c')
    assert(error3.VersionId == null)
  })

})
