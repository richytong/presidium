const assert = require('assert')
const Test = require('thunk-test')
const _S3 = require('./internal/_S3')
const S3Bucket = require('./S3Bucket')
const AwsCredentials = require('./AwsCredentials')

const test1 = new Test('S3Bucket', async function integration1() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  // const n = Math.floor(100000 + Math.random() * 900000)
  const n = 1
  const bucketName = `test-bucket-presidium-${n}`

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

  await testBucket.deleteObject('binary')

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
  }

  const binary = await testBucket.getObject('binary')
  assert.equal(binary.ContentType, 'application/octet-stream')
  assert.deepEqual(binary.Body, Buffer.from('binary'))

  const res = await testBucket.putObject('buffer', Buffer.from('buffer'))
  const buffer = await testBucket.getObject('buffer')
  assert(buffer.ContentType == 'application/octet-stream')
  assert.deepEqual(buffer.Body, Buffer.from('buffer'))

  {
    const key = 'buffer2'
    await testBucket.putObject(key, Buffer.from('buffer'))
    const headRes = await testBucket.headObject(key)
    assert.equal(headRes.ContentLength, 6)
    const res = await testBucket.getObjectStream(key)
    assert.equal(res.ContentLength, 6)
  }

  {
    const a = await testBucket.getObject('a')
    const body = a.Body.toString('utf8')
    assert.equal(body, '{"id":"a"}')
    await testBucket.deleteObjects(['a'])
    await assert.rejects(
      testBucket.getObject('a'),
      { name: 'NoSuchKey', message: 'The specified key does not exist.' },
    )
  }

  {
    let b = await testBucket.getObject('b')
    assert.equal(b.Body.toString('utf8'), '{"id":"b"}')
    await testBucket.deleteObjects([{ Key: 'b', VersionId: '0' }])
    b = await testBucket.getObject('b')
    assert.equal(b.Body.toString('utf8'), '{"id":"b"}')
    await testBucket.deleteObjects([{ Key: 'b' }]),
    await assert.rejects(
      testBucket.getObject('b'),
      { name: 'NoSuchKey', message: 'The specified key does not exist.' },
    )
  }

  {
    const response = await testBucket.listObjects({ Prefix: 'c', Delimiter: '/' })
    assert.equal(response.Contents.length, 1)
    assert.equal(response.Contents[0].Key, 'c')
    assert.equal(response.Prefix, 'c')
  }

  {
    const response = await testBucket.deleteAllObjects({ BatchSize: 1 })
    assert.deepEqual(response.Deleted, [
      { Key: 'binary' },
      { Key: 'buffer' },
      { Key: 'buffer2' },
      { Key: 'c' }
    ])
    assert.deepEqual(response.Errors, [])
  }

  {
    const deleted = await testBucket.delete()
    assert.deepEqual(deleted, {})
  }

  testBucket.closeConnections()
}).case()

const test2 = new Test('S3Bucket', async function integration2() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'
  const bucketName = 'test-bucket-presidium-2'

  {
    const testBucket2 = new S3Bucket({
      name: bucketName,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      IgnorePublicAcls: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      autoReady: false,
      ...awsCreds,
    })

    await testBucket2.deleteAllObjects().catch(() => {})
    await testBucket2.delete().catch(() => {})
    testBucket2.closeConnections()
  }

  {
    const testBucket2 = new S3Bucket({
      name: bucketName,
      ACL: 'public-read',
      ObjectOwnership: 'BucketOwnerPreferred',
      BlockPublicAccess: false,
      BlockPublicACLs: false,
      IgnorePublicAcls: false,
      RestrictPublicBuckets: false,
      RequestPayer: 'Requester',
      ...awsCreds
    })
    const { message } = await testBucket2.ready
    assert.equal(message, 'created-bucket')
    testBucket2.closeConnections()
  }

  const testBucket2 = new S3Bucket({
    name: bucketName,
    ACL: 'public-read',
    ObjectOwnership: 'BucketOwnerPreferred',
    BlockPublicAccess: false,
    BlockPublicACLs: false,
    IgnorePublicAcls: false,
    RestrictPublicBuckets: false,
    RequestPayer: 'Requester',
    ...awsCreds
  })

  {
    const { message } = await testBucket2.ready
    assert.equal(message, 'bucket-exists')
  }

  { // ACL option
    const key = 'test/acl'
    const data1 = await testBucket2.putObject(key, 'test', {
      ACL: 'aws-exec-read'
    })
    assert.equal(typeof data1.ETag, 'string')

    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.ContentType, 'application/octet-stream')

    const data3 = await testBucket2.getObjectACL(key)
    assert.equal(data3.Grants.length, 2)
    for (const Grant of data3.Grants) {
      assert.equal(Grant.Grantee.Type, 'CanonicalUser')
    }
    assert.equal(data3.Grants[0].Permission, 'FULL_CONTROL')
    assert.equal(data3.Grants[1].Permission, 'READ')
  }

  { // ACL option 2
    const key = 'test/acl2'
    const data1 = await testBucket2.putObject(key, 'test', {
      ACL: 'public-read-write'
    }) // should not error
    assert.equal(typeof data1.ETag, 'string')

    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.ContentType, 'application/octet-stream')

    const data3 = await testBucket2.getObjectACL(key)
  }

  { // CacheControl option
    const key = 'test/cache-control'
    const data1 = await testBucket2.putObject(key, 'test', {
      CacheControl: 'nocache'
    })
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.CacheControl, 'nocache')
  }

  testBucket2.closeConnections()
}).case()

const test = Test.all([
  test1,
  test2
])

if (process.argv[1] == __filename) {
  test()
  // test0()
  // test2()
}

module.exports = test
