require('rubico/global')
const assert = require('assert')
const stream = require('stream')
const Test = require('thunk-test')
const crypto = require('crypto')
const S3Bucket = require('./S3Bucket')
const AwsCredentials = require('./AwsCredentials')
const CRC32 = require('./internal/CRC32')
const crc32c = require('fast-crc32c')
const convertUint32ToBase64 = require('./internal/convertUint32ToBase64')
const { CrtCrc64Nvme } = require('@aws-sdk/crc64-nvme-crt')
const encodeURIComponentRFC3986 = require('./internal/encodeURIComponentRFC3986')

const test1 = new Test('S3Bucket', async function integration1() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  // const n = Math.floor(100000 + Math.random() * 900000)
  const n = 1
  const bucketName = `test.bucket-presidium-${n}`

  {
    const testBucket = new S3Bucket({
      name: bucketName,
      ...awsCreds,
      autoReady: false
    })

    await testBucket.deleteAllObjects().catch(() => {})
    await testBucket.delete().catch(() => {})
    testBucket.closeConnections()
  }

  {
    const testBucket = new S3Bucket({
      name: bucketName,
      ...awsCreds
    })
    const { message } = await testBucket.ready
    assert.equal(message, 'created-bucket')
    testBucket.closeConnections()
  }

  const testBucket = new S3Bucket({
    name: bucketName,
    ...awsCreds
  })

  {
    const { message } = await testBucket.ready
    assert.equal(message, 'bucket-exists')
  }

  await testBucket.deleteAllObjects()

  const deleteObjectResponse0 = await testBucket.deleteObject('binary')
  assert.equal(Object.keys(deleteObjectResponse0).length, 0)

  await testBucket.putObject('a', JSON.stringify({ id: 'a' }), {
    ContentType: 'application/json',
  })
  await testBucket.putObject('b', JSON.stringify({ id: 'b' }))
  await testBucket.putObject('c', JSON.stringify({ id: 'c' }))
  const a = await testBucket.getObject('a')
  assert(a.ETag == '"6a1a81494a7765ad411580b31c1b7044"')
  assert(a.Body.toString() == '{"id":"a"}')
  assert(a.ContentType == 'application/json')
  const s3Objects = await testBucket.listObjects()
  assert(s3Objects.Contents.length == 3)
  assert(s3Objects.Contents[0].Key == 'a')
  assert(s3Objects.Contents[1].Key == 'b')
  assert(s3Objects.Contents[2].Key == 'c')

  {
    const response = await testBucket.putObject('binary', Buffer.from('binary'))
    assert.equal(typeof response.ETag, 'string')
    const binary = await testBucket.getObject('binary')
    assert.equal(binary.ContentType, 'application/octet-stream')
    assert.deepEqual(binary.Body, Buffer.from('binary'))
  }

  {
    const response = await testBucket.putObject('ReadableStream', stream.Readable.from(['ReadableStream']))
    assert.equal(typeof response.ETag, 'string')
    const data = await testBucket.getObject('ReadableStream')
    assert.equal(data.ContentType, 'application/octet-stream')
    assert.deepEqual(data.Body, Buffer.from('ReadableStream'))
  }

  const res = await testBucket.putObject('buffer', Buffer.from('buffer'))
  const buffer = await testBucket.getObject('buffer')
  assert(buffer.ContentType == 'application/octet-stream')
  assert.deepEqual(buffer.Body, Buffer.from('buffer'))

  {
    const key = 'buffer2'
    await testBucket.putObject(key, Buffer.from('buffer'))
    const headRes = await testBucket.headObject(key)
    assert.equal(headRes.ContentLength, 6)
    const res = await testBucket.getObject(key, { Stream: true })
    assert.equal(res.ContentLength, 6)
  }

  {
    const a = await testBucket.getObject('a')
    const body = a.Body.toString('utf8')
    assert.equal(body, '{"id":"a"}')
    const deleteObjectResponse = await testBucket.deleteObject('a')
    assert.equal(Object.keys(deleteObjectResponse).length, 0)
    await assert.rejects(
      testBucket.getObject('a'),
      { name: 'NoSuchKey', message: 'The specified key does not exist.', code: 404 },
    )
  }

  {
    let b = await testBucket.getObject('b')
    assert.equal(b.Body.toString('utf8'), '{"id":"b"}')
    await testBucket.deleteObjects([{ Key: 'b', VersionId: '0' }])
    b = await testBucket.getObject('b')
    assert.equal(b.Body.toString('utf8'), '{"id":"b"}')
    await testBucket.deleteObjects(['b'])
    await assert.rejects(
      testBucket.getObject('b'),
      { name: 'NoSuchKey', message: 'The specified key does not exist.', code: 404 },
    )
  }

  {
    console.log('listObjects Prefix and Delimiter options')

    const response = await testBucket.listObjects({
      Prefix: 'c',
      Delimiter: '/',
    })
    assert.equal(response.KeyCount, 1)
    assert.equal(response.Contents.length, 1)
    assert.equal(response.Contents[0].Key, 'c')
  }

  {
    const response = await testBucket.deleteAllObjects({ BatchSize: 1 })
    assert.deepEqual(response.Deleted.map(pick(['Key'])), [
      { Key: 'ReadableStream' },
      { Key: 'binary' },
      { Key: 'buffer' },
      { Key: 'buffer2' },
      { Key: 'c' }
    ])
  }

  {
    console.log('listObjects EncodingType option 0')

    const specialKey = ':::/:::%"!#$&\'()*, ;=?@[]'
    await testBucket.putObject(specialKey, 'test')
    const data1 = await testBucket.listObjects()
    assert.equal(data1.Contents.length, 1)
    assert.equal(data1.Contents[0].Key, specialKey)

    const data2 = await testBucket.listObjects({
      EncodingType: 'url',
    })
    assert.equal(data2.Contents.length, 1)
    assert.equal(data2.Contents[0].Key, encodeURIComponentRFC3986(specialKey).replace(/%2F/g, '/').replace(/%2A/g, '*').replace(/%20/g, '+'))

    const data3 = await testBucket.getObject(specialKey)
    assert.equal(data3.Body.toString('utf8'), 'test')
  }

  await testBucket.deleteAllObjects()

  {
    console.log('listObjects EncodingType option')

    const specialKey = encodeURIComponentRFC3986(':::/:::%"!#$&\'()*, ;=?@[]')
    await testBucket.putObject(specialKey, 'test')
    const data1 = await testBucket.listObjects()
    assert.equal(data1.Contents.length, 1)
    assert.equal(data1.Contents[0].Key, specialKey)
    assert.equal(data1.Contents[0].Key, specialKey)

    const data2 = await testBucket.listObjects({
      EncodingType: 'url',
    })
    assert.equal(data2.Contents.length, 1)
    assert.equal(data2.Contents[0].Key, encodeURIComponentRFC3986(specialKey))

    const data3 = await testBucket.getObject(specialKey)
    assert.equal(data3.Body.toString('utf8'), 'test')
  }

  {
    console.log('FetchOwner option')

    const data1 = await testBucket.listObjects({
      FetchOwner: true,
    })
    assert.equal(data1.Contents.length, 1)
    assert.equal(typeof data1.Contents[0].Owner, 'object')
  }

  await testBucket.deleteAllObjects()

  {
    console.log('MaxKeys, StartAfter options')

    await testBucket.putObject('max-keys-1', 'test')
    await testBucket.putObject('max-keys-2', 'test')
    await testBucket.putObject('max-keys-3', 'test')
    const data1 = await testBucket.listObjects()
    assert(data1.KeyCount > 1)
    assert(data1.Contents.length > 1)
    assert(!data1.IsTruncated)

    const data2 = await testBucket.listObjects({ MaxKeys: 1 })
    assert(data2.KeyCount == 1)
    assert(data2.Contents.length == 1)
    assert(data2.IsTruncated)
    assert.equal(typeof data2.NextContinuationToken, 'string')

    const data4 = await testBucket.listObjects({
      ContinuationToken: data2.NextContinuationToken,
      MaxKeys: 1,
    })
    assert(data4.KeyCount == 1)
    assert(data4.Contents.length == 1)
    assert(data4.IsTruncated)
    assert.equal(typeof data4.NextContinuationToken, 'string')
    assert.notEqual(data4.NextContinuationToken, data2.NextContinuationToken)
    const data4Keys = data4.Contents.map(get('Key'))
    assert(!data4Keys.includes(data2.Contents[0].Key))

    const data3 = await testBucket.listObjects({ StartAfter: 'max-keys-1' })
    assert(data3.KeyCount > 1)
    assert(data3.Contents.length > 1)
    assert(!data3.IsTruncated)
    const data3Keys = data3.Contents.map(get('Key'))
    assert(!data3Keys.includes('max-keys-1'))
  }


  await testBucket.deleteAllObjects()

  {
    const deleted = await testBucket.delete()
    assert.deepEqual(deleted, {})
  }

  testBucket.closeConnections()
}).case()

const test2 = new Test('S3Bucket', async function integration2() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  {
    console.log('default retention period 1 year (ObjectLockDefaultRetentionYears=1)')

    const bucketName02 = `test-bucket-presidium-${Date.now()}-02`
    const testBucket02 = new S3Bucket({
      name: bucketName02,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      ObjectLockEnabled: true,
      ObjectLockDefaultRetentionMode: 'COMPLIANCE',
      ObjectLockDefaultRetentionYears: 1,
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      ...awsCreds
    })
    const { message } = await testBucket02.ready
    assert.equal(message, 'created-bucket')

    const data1 = await testBucket02.putObject('test/retention-period-1-year', 'test')
    await assert.rejects(
      testBucket02.deleteObject('test/retention-period-1-year', {
        VersionId: data1.VersionId
      }),
      { name: 'AccessDenied', message: 'Access Denied because object protected by object lock.', code: 403 },
    )

  
    console.log('simple delete creates DeleteMarker')
    const data2 = await testBucket02.deleteObject('test/retention-period-1-year')
    assert(data2.DeleteMarker)

    testBucket02.closeConnections()
  }

  assert.throws(
    () => {
      new S3Bucket({
        name: `test-bucket-presidium-${Date.now()}-object-lock-config-error`,
        ACL: 'public-read',
        ObjectOwnership: 'BucketOwnerPreferred',
        BlockPublicAccess: false,
        BlockPublicACLs: false,
        BlockPublicPolicy: false,
        IgnorePublicACLs: false,
        RestrictPublicBuckets: false,
        RequestPayer: 'Requester',
        ObjectLockEnabled: true,
        ObjectLockDefaultRetentionMode: 'COMPLIANCE',
        VersioningMfaDelete: 'Disabled',
        VersioningStatus: 'Enabled',
        ...awsCreds
      })
    },
    new Error('ObjectLockDefaultRetentionDays or ObjectLockDefaultRetentionYears must be specified with ObjectLockDefaultRetentionMode'),
  )

  {
    console.log('default retention period must be a positive integer value (error when ObjectLockDefaultRetentionYears 0 or ObjectLockDefaultRetentionDays 0)')

    const bucketName03 = `test-bucket-presidium-${Date.now()}-03`
    const testBucket03 = new S3Bucket({
      name: bucketName03,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      ObjectLockEnabled: true,
      ObjectLockDefaultRetentionMode: 'COMPLIANCE',
      ObjectLockDefaultRetentionYears: 0,
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      ...awsCreds
    })

    await assert.rejects(
      testBucket03.ready,
      { name: 'InvalidArgument', message: 'Default retention period must be a positive integer value.', code: 400 }
    )

    testBucket03.closeConnections()
    await testBucket03.delete()
  }

  {
    console.log('default retention period 1 day')

    const bucketName04 = `test-bucket-presidium-${Date.now()}-04`
    const testBucket04 = new S3Bucket({
      name: bucketName04,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      ObjectLockEnabled: true,
      ObjectLockDefaultRetentionMode: 'COMPLIANCE',
      ObjectLockDefaultRetentionDays: 1,
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      ...awsCreds
    })
    const { message } = await testBucket04.ready
    assert.equal(message, 'created-bucket')

    const data1 = await testBucket04.putObject('test/retention-period-1-day', 'test')
    await assert.rejects(
      testBucket04.deleteObject('test/retention-period-1-day', {
        VersionId: data1.VersionId,
      }),
      { name: 'AccessDenied', message: 'Access Denied because object protected by object lock.', code: 403 },
    )

  
    console.log('simple delete creates DeleteMarker')
    const data2 = await testBucket04.deleteObject('test/retention-period-1-year')
    assert(data2.DeleteMarker)

    testBucket04.closeConnections()
  }

  const bucketName = `test-bucket-presidium-${Date.now()}`


  {
    console.log('ObjectLock enabled with no default retention period: new objects will not be locked by default, allowing immediate deletion or overwriting')

    const testBucket2 = new S3Bucket({
      name: bucketName,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      ObjectLockEnabled: true,
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      ...awsCreds
    })
    const { message } = await testBucket2.ready
    assert.equal(message, 'created-bucket')
  }

  const testBucket2 = new S3Bucket({
    name: bucketName,
    ACL: 'public-read',
    ObjectOwnership: 'BucketOwnerPreferred',
    BlockPublicAccess: false,
    BlockPublicACLs: false,
    BlockPublicPolicy: false,
    IgnorePublicACLs: false,
    RestrictPublicBuckets: false,
    RequestPayer: 'Requester',
    ObjectLockEnabled: true,
    VersioningMfaDelete: 'Disabled',
    VersioningStatus: 'Enabled',
    ...awsCreds
  })

  {
    const { message } = await testBucket2.ready
    assert.equal(message, 'bucket-exists')
  }

  {
    console.log('delete object version succeeds')

    const key = 'test/bucket-2-simple-delete-no-default-retention'
    const data1 = await testBucket2.putObject(key, 'test')
    await testBucket2.deleteObject(key, {
      VersionId: data1.VersionId,
    })
    assert(!data1.DeleteMarker) // object version was deleted

    await assert.rejects(
      testBucket2.getObject(key),
      error => {
        assert.equal(error.name, 'NoSuchKey')
        assert.equal(error.message, 'The specified key does not exist.')
        assert.equal(error.code, 404)
        assert(!error.DeleteMarker)
        return true
      },
    )

  
    console.log('simple delete creates a delete marker (no delete marker)')
    const data2 = await testBucket2.deleteObject(key)
    assert(data2.DeleteMarker) // delete marker was created and is now the current version
  }

  {
    console.log('ObjectLockMode, ObjectLockRetainUntilDate, ObjectLockLegalHoldStatus')

    const key = 'test/ObjectLockMode-ObjectLockRetainUntilDate-ObjectLockLegalHoldStatus-options'
    const ObjectLockMode = 'COMPLIANCE'
    const ObjectLockRetainUntilDate = new Date(Date.now() + 10000).toISOString()
    const ObjectLockLegalHoldStatus = 'ON'
    await testBucket2.putObject(key, 'test', {
      ObjectLockMode,
      ObjectLockRetainUntilDate,
      ObjectLockLegalHoldStatus,
    })
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.ObjectLockMode, ObjectLockMode)
    assert.equal(data2.ObjectLockRetainUntilDate, ObjectLockRetainUntilDate)
    assert.equal(data2.ObjectLockLegalHoldStatus, ObjectLockLegalHoldStatus)
  }

  {
    console.log('deleteAllObjects error')

    await assert.rejects(
      testBucket2.deleteAllObjects(),
      error => {
        assert.equal(error.name, 'AggregateError')
        assert.equal(error.errors.length, 1)
        assert.equal(error.errors[0].name, 'AccessDenied')
        assert.equal(error.errors[0].message, 'Access Denied because object protected by object lock.')
        return true
      }
    )
  }

  testBucket2.closeConnections()
}).case()

const test3 = new Test('S3Bucket', async function integration3() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'
  const bucketName = `test-bucket-presidium-${Date.now()}`
  // const bucketName = `test-bucket-presidium-3`

  {
    const testBucket3 = new S3Bucket({
      name: bucketName,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      autoReady: false,
      ...awsCreds
    })

    await testBucket3.deleteAllObjects().catch(() => {})
    await testBucket3.delete().catch(() => {})
    testBucket3.closeConnections()
  }

  {
    const testBucket3 = new S3Bucket({
      name: bucketName,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      BlockPublicPolicy: false,
      IgnorePublicACLs: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      VersioningMfaDelete: 'Disabled',
      VersioningStatus: 'Enabled',
      ...awsCreds
    })
    const { message } = await testBucket3.ready
    assert.equal(message, 'created-bucket')
    testBucket3.closeConnections()
  }

  const testBucket3 = new S3Bucket({
    name: bucketName,
    ACL: 'public-read',
    ObjectOwnership: 'BucketOwnerPreferred',
    BlockPublicAccess: false,
    BlockPublicACLs: false,
    BlockPublicPolicy: false,
    IgnorePublicACLs: false,
    RestrictPublicBuckets: false,
    RequestPayer: 'Requester',
    VersioningMfaDelete: 'Disabled',
    VersioningStatus: 'Enabled',
    ...awsCreds
  })

  {
    const { message } = await testBucket3.ready
    assert.equal(message, 'bucket-exists')
  }

  {
    console.log('putPolicy, getPolicy')

    const policy = {
      "Version": "2008-10-17",
      "Id": "Policy1380877762691",
      "Statement": [
        {
          "Sid": "Stmt1380877761162",
          "Effect": "Allow",
          "Principal": {
            "AWS": "*"
          },
          "Action": "s3:GetObject",
          "Resource": `arn:aws:s3:::${bucketName}/*`,
        }
      ]
    }

    await testBucket3.putPolicy({
      policy,
    })

    const policy2 = await testBucket3.getPolicy()
    assert.equal(policy.Version, policy2.Version)
    assert.equal(policy.Id, policy2.Id)
    assert.deepEqual(policy.Statement, policy2.Statement)
  }

  {
    console.log('Stream option')

    const key = 'test/Stream'
    await testBucket3.putObject(key, 'test')
    const data2 = await testBucket3.getObject(key, {
      Stream: true,
    })
    assert(data2.Body instanceof stream.Readable)
  }

  {
    console.log('getObject, deleteObject VersionId')

    const key = 'test/getObject-VersionId'
    const data1 = await testBucket3.putObject(key, 'test')
    assert.equal(typeof data1.VersionId, 'string')
    const VersionId = data1.VersionId
    const data2 = await testBucket3.putObject(key, 'test2') // should overwrite
    assert.notEqual(typeof data2.VersionId, data1.VersionId)
    const data3 = await testBucket3.getObject(key, {
      VersionId,
    })
    assert.equal(data3.VersionId, data1.VersionId)
    assert.equal(data3.Body.toString('utf8'), 'test')

    const data4 = await testBucket3.deleteObject(key, {
      VersionId,
    })
    assert.equal(data4.VersionId, data1.VersionId)

    await assert.rejects(
      testBucket3.getObject(key, {
        VersionId,
      }),
      { name: 'NoSuchVersion', message: 'The specified version does not exist.', code: 404 },
    )
  }

  {
    console.log('deleteObject with delete marker')

    const key = 'test/getObject-delete-marker/:%"!#$&\'()*, ;=?@[]'
    const data1 = await testBucket3.putObject(key, 'test')
    assert.equal(typeof data1.VersionId, 'string')
    const VersionId = data1.VersionId
    const data2 = await testBucket3.putObject(key, 'test2') // should overwrite
    assert.notEqual(typeof data2.VersionId, data1.VersionId)
    const data3 = await testBucket3.getObject(key, {
      VersionId,
    })
    assert.equal(data3.VersionId, data1.VersionId)
    assert.equal(data3.Body.toString('utf8'), 'test')

    const data4 = await testBucket3.deleteObject(key)
    assert.equal(typeof data4.VersionId, 'string')
    const deleteMarker = data4.VersionId
    assert.equal(data4.DeleteMarker, true) // delete marker is created

    // current version is a delete marker

    await assert.rejects(
      testBucket3.getObject(key),
      { name: 'NoSuchKey', message: 'The specified key does not exist.', code: 404, DeleteMarker: true },
    )

    await assert.rejects(
      testBucket3.getObject(key, { VersionId: deleteMarker }),
      { name: 'MethodNotAllowed', message: 'The specified method is not allowed against this resource.', code: 405, DeleteMarker: true },
    )

    // delete the delete marker (un-deletes the object)
    const data5 = await testBucket3.deleteObject(key, {
      VersionId: deleteMarker,
    })
    assert.equal(data5.VersionId, deleteMarker)
    assert.equal(data5.DeleteMarker, true)

    // current version should be last version before delete marker, or data2.VersionId
    const data6 = await testBucket3.getObject(key)
    assert.equal(data6.VersionId, data2.VersionId)
    const data7 = await testBucket3.headObject(key)
    assert.equal(data7.VersionId, data2.VersionId)

  }

  {
    console.log('ACL option + VersionId in response')

    const key = 'test/acl/:%"!#$&\'()*, ;=?@[]'
    const data1 = await testBucket3.putObject(key, 'test', {
      ACL: 'aws-exec-read'
    })
    assert.equal(typeof data1.ETag, 'string')
    assert.equal(typeof data1.VersionId, 'string')

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.ContentType, 'application/octet-stream')
    assert.equal(typeof data2.VersionId, 'string')

    const data4 = await testBucket3.headObject(key)
    assert.equal(data4.ContentType, 'application/octet-stream')
    assert.equal(typeof data4.VersionId, 'string')

    const data3 = await testBucket3.getObjectACL(key, {
      VersionId: data4.VersionId,
    })
    assert.equal(data3.Grants.length, 2)
    for (const Grant of data3.Grants) {
      assert.equal(Grant.Grantee.Type, 'CanonicalUser')
    }
    assert.equal(data3.Grants[0].Permission, 'FULL_CONTROL')
    assert.equal(data3.Grants[1].Permission, 'READ')

    const data5 = await testBucket3.getObjectACL(key)
    assert.equal(data5.Grants.length, 2)
    for (const Grant of data5.Grants) {
      assert.equal(Grant.Grantee.Type, 'CanonicalUser')
    }
    assert.equal(data5.Grants[0].Permission, 'FULL_CONTROL')
    assert.equal(data5.Grants[1].Permission, 'READ')
  }

  {
    console.log('ACL option 2')

    const key = 'test/acl2'
    const data1 = await testBucket3.putObject(key, 'test', {
      ACL: 'public-read-write'
    }) // should not error
    assert.equal(typeof data1.ETag, 'string')

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.ContentType, 'application/octet-stream')

    const data4 = await testBucket3.headObject(key)
    assert.equal(data4.ContentType, 'application/octet-stream')

    const data3 = await testBucket3.getObjectACL(key)
  }

  {
    console.log('CacheControl, ContentDisposition, ContentEncoding, ContentLanguage, ContentLength, ContentMD5, ContentType, Expires options')

    const date = new Date()
    const key = 'test/cache-control'
    const data1 = await testBucket3.putObject(key, 'test', {
      CacheControl: 'nocache',
      ContentDisposition: 'inline',
      ContentEncoding: 'gzip',
      ContentLanguage: 'en-US',
      ContentLength: '4',
      ContentMD5: crypto.createHash('md5').update('test', 'utf8').digest('base64'), // should not error
      ContentType: 'text/plain',
      Expires: date,
    })
    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.CacheControl, 'nocache')
    assert.equal(data2.ContentDisposition, 'inline')
    assert.equal(data2.ContentEncoding, 'gzip')
    assert.equal(data2.ContentLanguage, 'en-US')
    assert.equal(data2.ContentLength, '4')
    assert.equal(data2.ContentType, 'text/plain')
    assert.equal(data2.Expires, date)

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.CacheControl, 'nocache')
    assert.equal(data3.ContentDisposition, 'inline')
    assert.equal(data3.ContentEncoding, 'gzip')
    assert.equal(data3.ContentLanguage, 'en-US')
    assert.equal(data3.ContentLength, '4')
    assert.equal(data3.ContentType, 'text/plain')
    assert.equal(data3.Expires, date)

  
    console.log('ResponseCacheControl, ResponseContentDisposition, ResponseContentEncoding, ResponseContentLanguage, ResponseContentType, ResponseExpires')

    const data4 = await testBucket3.getObject(key, {
      ResponseCacheControl: 'cache',
      ResponseContentDisposition: 'attachment',
      ResponseContentEncoding: 'compress',
      ResponseContentLanguage: 'de-DE',
      ResponseContentType: 'application/json',
      ResponseExpires: new Date('Wed, 21 Oct 2015 07:28:00 GMT'),
    })
    assert.equal(data4.CacheControl, 'cache')
    assert.equal(data4.ContentDisposition, 'attachment')
    assert.equal(data4.ContentEncoding, 'compress')
    assert.equal(data4.ContentLanguage, 'de-DE')
    assert.equal(data4.ContentLength, '4')
    assert.equal(data4.ContentType, 'application/json')
    assert.equal(data4.Expires, new Date('Wed, 21 Oct 2015 07:28:00 GMT').toISOString())

    const data5 = await testBucket3.headObject(key, {
      ResponseCacheControl: 'cache',
      ResponseContentDisposition: 'attachment',
      ResponseContentEncoding: 'compress',
      ResponseContentLanguage: 'de-DE',
      ResponseContentType: 'application/json',
      ResponseExpires: new Date('Wed, 21 Oct 2015 07:28:00 GMT'),
    })
    assert.equal(data5.CacheControl, 'cache')
    assert.equal(data5.ContentDisposition, 'attachment')
    assert.equal(data5.ContentEncoding, 'compress')
    assert.equal(data5.ContentLanguage, 'de-DE')
    assert.equal(data5.ContentType, 'application/json')
    assert.equal(data5.Expires, new Date('Wed, 21 Oct 2015 07:28:00 GMT').toISOString())

  }

  {
    console.log('ChecksumAlgorithm, ChecksumCRC32 options')

    const key = 'test/checksum-crc32'
    const body = 'test-checksum-crc32'

    const crc32 = new CRC32()
    crc32.update(Buffer.from(body, 'utf8'))
    const base64Checksum = convertUint32ToBase64(crc32.checksum)

    const data1 = await testBucket3.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC32',
      ChecksumCRC32: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC32, base64Checksum)

    const data2 = await testBucket3.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC32, base64Checksum)

    const data3 = await testBucket3.headObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data3.ChecksumCRC32, base64Checksum)
  }

  {
    console.log('ChecksumAlgorithm, ChecksumCRC32C options')

    const key = 'test/checksum-crc32c'
    const body = 'test-checksum-crc32c'

    const checksum = crc32c.calculate(body)
    const base64Checksum = convertUint32ToBase64(checksum)

    const data1 = await testBucket3.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC32C',
      ChecksumCRC32C: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC32C, base64Checksum)

    const data2 = await testBucket3.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC32C, base64Checksum)

    const data3 = await testBucket3.headObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data3.ChecksumCRC32C, base64Checksum)
  }

  {
    console.log('ChecksumAlgorithm, ChecksumCRC64NVME options')

    const key = 'test/checksum-crc64nvme'
    const body = 'test-checksum-crc64nvme'

    const crc64 = new CrtCrc64Nvme()
    crc64.update(Buffer.from(body, 'utf8'))
    const result = await crc64.digest()
    const base64Checksum = Buffer.from(result).toString('base64')

    const data1 = await testBucket3.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC64NVME',
      ChecksumCRC64NVME: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC64NVME, base64Checksum)

    const data2 = await testBucket3.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC64NVME, base64Checksum)

    const data3 = await testBucket3.headObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data3.ChecksumCRC64NVME, base64Checksum)
  }

  {
    console.log('ChecksumAlgorithm, ChecksumSHA1 options')

    const key = 'test/checksum-sha1'
    const body = 'test-checksum-sha1'

    const base64Checksum = crypto.createHash('sha1').update(body).digest('base64')

    const data1 = await testBucket3.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumSHA1',
      ChecksumSHA1: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumSHA1, base64Checksum)

    const data2 = await testBucket3.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumSHA1, base64Checksum)

    const data3 = await testBucket3.headObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data3.ChecksumSHA1, base64Checksum)
  }

  {
    console.log('ChecksumAlgorithm, ChecksumSHA256 options')

    const key = 'test/checksum-sha256'
    const body = 'test-checksum-sha256'

    const base64Checksum = crypto.createHash('sha256').update(body).digest('base64')

    const data1 = await testBucket3.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumSHA256',
      ChecksumSHA256: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumSHA256, base64Checksum)

    const data2 = await testBucket3.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumSHA256, base64Checksum)

    const data3 = await testBucket3.headObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data3.ChecksumSHA256, base64Checksum)
  }

  {
    console.log('IfNoneMatch option')

    const key = 'test/if-match-option'
    const data1 = await testBucket3.putObject(key, 'test', {
      IfNoneMatch: '*',
    })
    await testBucket3.getObject(key)
    await assert.rejects(
      () => testBucket3.putObject(key, 'test', {
        IfNoneMatch: '*',
      }),
      { name: 'PreconditionFailed', message: 'At least one of the pre-conditions you specified did not hold', code: 412 },
    )
  }

  {
    console.log('ServerSideEncryption, SSEKMSKeyId, SSEKMSEncryptionContext options')

    const key = 'test/ServerSideEncryption-SSEKMSKeyId-SSEKMSEncryptionContext-option'
    const encryptionContext = { a: '1' }
    const data1 = await testBucket3.putObject(key, 'test', {
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'alias/presidium-test',
      SSEKMSEncryptionContext: Buffer.from(JSON.stringify(encryptionContext), 'utf8').toString('base64'),
    })
    assert.equal(data1.ServerSideEncryption, 'aws:kms')
    assert.equal(data1.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    const encryptionContext1 = JSON.parse(Buffer.from(data1.SSEKMSEncryptionContext, 'base64').toString('utf8'))
    assert.equal(encryptionContext1.a, '1')

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.ServerSideEncryption, 'aws:kms')
    assert.equal(data2.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.ServerSideEncryption, 'aws:kms')
    assert.equal(data3.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
  }

  {
    console.log('ServerSideEncryption, SSEKMSKeyId, BucketKeyEnabled options')

    const key = 'test/ServerSideEncryption-SSEKMSKeyId-BucketKeyEnabled-option'
    const encryptionContext = { a: '1' }
    const data1 = await testBucket3.putObject(key, 'test', {
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'alias/presidium-test',
      BucketKeyEnabled: true,
    })
    assert.equal(data1.ServerSideEncryption, 'aws:kms')
    assert.equal(data1.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    assert.strictEqual(data1.BucketKeyEnabled, true)

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.ServerSideEncryption, 'aws:kms')
    assert.equal(data2.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    assert.strictEqual(data2.BucketKeyEnabled, true)

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.ServerSideEncryption, 'aws:kms')
    assert.equal(data3.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    assert.strictEqual(data3.BucketKeyEnabled, true)
  }

  {
    console.log('StorageClass option')

    const key = 'test/StorageClass-option'
    await testBucket3.putObject(key, 'test', {
      StorageClass: 'REDUCED_REDUNDANCY',
    })

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.StorageClass, 'REDUCED_REDUNDANCY')

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.StorageClass, 'REDUCED_REDUNDANCY')
  }

  {
    console.log('WebsiteRedirectLocation option')

    const key = 'test/WebsiteRedirectLocation-option'
    const data1 = await testBucket3.putObject(key, 'test', {
      WebsiteRedirectLocation: '/test',
    })

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.WebsiteRedirectLocation, '/test')

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.WebsiteRedirectLocation, '/test')
  }

  {
    console.log('SSECustomerAlgorithm, SSECustomerKey options')

    const key = 'test/SSECustomerAlgorithm-SSECustomerKey-option'
    const SSECustomerKey = '8spSZEuMkTTwG5Taq1lObxkaJiSOxHmkkPK9Q+WzN5k='
    const SSECustomerKeyMD5 = 'CFvXiGVeD8YIPWCv+UJEBA=='
    const data1 = await testBucket3.putObject(key, 'test', {
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey,
      SSECustomerKeyMD5,
    })
    assert.equal(data1.SSECustomerAlgorithm, 'AES256')
    assert.equal(data1.SSECustomerKeyMD5, SSECustomerKeyMD5)

    const data2 = await testBucket3.getObject(key, {
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey,
      SSECustomerKeyMD5,
    })
    assert.equal(data2.SSECustomerAlgorithm, 'AES256')
    assert.equal(data2.SSECustomerKeyMD5, SSECustomerKeyMD5)

    const data3 = await testBucket3.headObject(key, {
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey,
      SSECustomerKeyMD5,
    })
    assert.equal(data3.SSECustomerAlgorithm, 'AES256')
    assert.equal(data3.SSECustomerKeyMD5, SSECustomerKeyMD5)
  }

  {
    console.log('Tagging option')

    const key = 'test/Tagging-option'
    const Tagging = 'a=1&b=test'
    await testBucket3.putObject(key, 'test', {
      Tagging,
    })

    const data2 = await testBucket3.getObject(key)
    assert.equal(data2.TagCount, 2)
    assert.equal(data2.AcceptRanges, 'bytes')

    const data3 = await testBucket3.headObject(key)
    assert.equal(data3.TagCount, 2)
    assert.equal(data3.AcceptRanges, 'bytes')
  }

  {
    console.log('Range option')

    const key = 'test/Range'
    await testBucket3.putObject(key, 'test')

    const data2 = await testBucket3.getObject(key, {
      Range: 'bytes=0-1'
    })
    assert.equal(data2.AcceptRanges, 'bytes')
    assert.equal(Buffer.from(data2.Body, 'utf8').length, 2)

    const data3 = await testBucket3.headObject(key, {
      Range: 'bytes=0-1'
    })
    assert.equal(data3.AcceptRanges, 'bytes')
  }

  {
    console.log('GrantFullControl, GrantRead, GrantReadACP, GrantWriteACP optionss')

    const key = 'test/grant-read-write-full-control-option'
    await testBucket3.putObject(key, 'test', {
      GrantFullControl: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantRead: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantReadACP: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantWriteACP: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
    })
    await testBucket3.getObject(key)
    await testBucket3.headObject(key)
    // no error
  }

  {
    console.log('deleteAllObjects')

    const data1 = await testBucket3.deleteAllObjects()
    assert(data1.Deleted.length > 0)
  }

  {
    console.log('listObjectVersions Prefix and Delimiter options')

    await testBucket3.putObject('c/b', 'test1')
    await testBucket3.putObject('c/b', 'test2')
    await testBucket3.putObject('c/b', 'test3')
    await testBucket3.putObject('c/c', 'test1')

    const data1 = await testBucket3.listObjectVersions({
      Prefix: 'c',
      Delimiter: '/',
    })
    assert.equal(data1.CommonPrefixes.length, 1)
    assert.equal(data1.CommonPrefixes[0].Prefix, 'c/')
    assert.equal(data1.Versions.length, 0)
    assert.equal(data1.DeleteMarkers.length, 0)

    const data3 = await testBucket3.listObjectVersions({
      Prefix: 'c',
      Delimiter: '/',
    })
    assert.equal(data3.CommonPrefixes.length, 1)
    assert.equal(data3.CommonPrefixes[0].Prefix, 'c/')
    assert.equal(data3.Versions.length, 0)
    assert.equal(data3.DeleteMarkers.length, 0)

    const data2 = await testBucket3.listObjectVersions({
      Prefix: 'c/',
      Delimiter: '/',
    })
    assert.strictEqual(data2.CommonPrefixes, undefined)
    assert.equal(data2.Versions.length, 4)
    assert.equal(data2.DeleteMarkers.length, 0)
  }

  await testBucket3.deleteAllObjects()

  {
    console.log('listObjectVersions KeyMarker, VersionIdMarker, MaxKeys options')

    await testBucket3.putObject('c', 'test1')
    await testBucket3.putObject('c', 'test2')
    await testBucket3.putObject('c', 'test3')

    const data1 = await testBucket3.listObjectVersions({
      MaxKeys: 1,
    })
    assert.equal(data1.Versions.length, 1)
    assert.equal(data1.DeleteMarkers.length, 0)
    assert.equal(typeof data1.NextKeyMarker, 'string')
    assert.equal(typeof data1.NextVersionIdMarker, 'string')
    assert(data1.IsTruncated)

    const data2 = await testBucket3.listObjectVersions({
      MaxKeys: 1,
      KeyMarker: data1.NextKeyMarker,
      VersionIdMarker: data1.NextVersionIdMarker,
    })
    assert.equal(data2.Versions.length, 1)
    assert.equal(data2.DeleteMarkers.length, 0)
    assert.equal(typeof data2.NextKeyMarker, 'string')
    assert.equal(typeof data2.NextVersionIdMarker, 'string')
    assert.equal(data2.Versions[0].Key, data1.Versions[0].Key)
    assert.notEqual(data2.Versions[0].VersionId, data1.Versions[0].VersionId)
    assert(data2.IsTruncated)
  }

  await testBucket3.deleteAllObjects()

  {
    console.log('listObjectVersions EncodingType option')

    const specialKey = ':::/:::%"!#$&\'()*, ;=?@[]'
    // const specialKey = ':::/:::%"!'
    // const specialKey = ':::/:::'
    await testBucket3.putObject(specialKey, 'test')
    const data1 = await testBucket3.listObjectVersions()
    assert.equal(data1.Versions.length, 1)
    assert.equal(data1.Versions[0].Key, specialKey)

    const data2 = await testBucket3.listObjectVersions({
      EncodingType: 'url',
    })
    assert.equal(data2.Versions.length, 1)
    console.log('* should be encoded', data2.Versions[0].Key, encodeURIComponentRFC3986(specialKey).replace(/%2F/g, '/'))
    assert.equal(data2.Versions[0].Key, encodeURIComponentRFC3986(specialKey).replace(/%2F/g, '/').replace(/%2A/g, '*').replace(/%20/g, '+'))

    const data3 = await testBucket3.getObject(specialKey)
    assert.equal(data3.Body.toString('utf8'), 'test')
  }

  {
    console.log('delete')

    await testBucket3.deleteAllObjects()
    await testBucket3.delete()
  }

  testBucket3.closeConnections()
}).case()

const test = Test.all([
  test1,
  test2,
  test3,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
