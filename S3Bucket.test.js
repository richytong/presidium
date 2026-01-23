const assert = require('assert')
const Test = require('thunk-test')
const crypto = require('crypto')
const _S3 = require('./internal/_S3')
const S3Bucket = require('./S3Bucket')
const AwsCredentials = require('./AwsCredentials')
const CRC32 = require('./internal/CRC32')
const crc32c = require('fast-crc32c')
const convertUint32ToBase64 = require('./internal/convertUint32ToBase64')
const { CrtCrc64Nvme } = require('@aws-sdk/crc64-nvme-crt')

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

  { // CacheControl, ContentDisposition, ContentEncoding, ContentLanguage, ContentLength, ContentMD5, ContentType, Expires options
    const date = new Date()
    const key = 'test/cache-control'
    const data1 = await testBucket2.putObject(key, 'test', {
      CacheControl: 'nocache',
      ContentDisposition: 'inline',
      ContentEncoding: 'gzip',
      ContentLanguage: 'en-US',
      ContentLength: '4',
      ContentMD5: crypto.createHash('md5').update('test', 'utf8').digest('base64'), // should not error
      ContentType: 'text/plain',
      Expires: date,
    })
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.CacheControl, 'nocache')
    assert.equal(data2.ContentDisposition, 'inline')
    assert.equal(data2.ContentEncoding, 'gzip')
    assert.equal(data2.ContentLanguage, 'en-US')
    assert.equal(data2.ContentLength, '4')
    assert.equal(data2.ContentType, 'text/plain')
    assert.equal(data2.Expires, date)
  }

  { // ChecksumAlgorithm, ChecksumCRC32 options
    const key = 'test/checksum-crc32'
    const body = 'test-checksum-crc32'

    const crc32 = new CRC32()
    crc32.update(Buffer.from(body, 'utf8'))
    const base64Checksum = convertUint32ToBase64(crc32.checksum)

    const data1 = await testBucket2.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC32',
      ChecksumCRC32: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC32, base64Checksum)

    const data2 = await testBucket2.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC32, base64Checksum)
  }

  { // ChecksumAlgorithm, ChecksumCRC32C options
    const key = 'test/checksum-crc32c'
    const body = 'test-checksum-crc32c'

    const checksum = crc32c.calculate(body)
    const base64Checksum = convertUint32ToBase64(checksum)

    const data1 = await testBucket2.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC32C',
      ChecksumCRC32C: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC32C, base64Checksum)

    const data2 = await testBucket2.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC32C, base64Checksum)
  }

  { // ChecksumAlgorithm, ChecksumCRC64NVME options
    const key = 'test/checksum-crc64nvme'
    const body = 'test-checksum-crc64nvme'

    const crc64 = new CrtCrc64Nvme()
    crc64.update(Buffer.from(body, 'utf8'))
    const result = await crc64.digest()
    const base64Checksum = Buffer.from(result).toString('base64')

    const data1 = await testBucket2.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumCRC64NVME',
      ChecksumCRC64NVME: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumCRC64NVME, base64Checksum)

    const data2 = await testBucket2.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumCRC64NVME, base64Checksum)
  }

  { // ChecksumAlgorithm, ChecksumSHA1 options
    const key = 'test/checksum-sha1'
    const body = 'test-checksum-sha1'

    const base64Checksum = crypto.createHash('sha1').update(body).digest('base64')

    const data1 = await testBucket2.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumSHA1',
      ChecksumSHA1: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumSHA1, base64Checksum)

    const data2 = await testBucket2.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumSHA1, base64Checksum)
  }

  { // ChecksumAlgorithm, ChecksumSHA256 options
    const key = 'test/checksum-sha256'
    const body = 'test-checksum-sha256'

    const base64Checksum = crypto.createHash('sha256').update(body).digest('base64')

    const data1 = await testBucket2.putObject(key, body, {
      ChecksumAlgorithm: 'ChecksumSHA256',
      ChecksumSHA256: base64Checksum
    })
    assert.equal(data1.ChecksumType, 'FULL_OBJECT')
    assert.equal(data1.ChecksumSHA256, base64Checksum)

    const data2 = await testBucket2.getObject(key, {
      ChecksumMode: 'Enabled'
    })
    assert.equal(data2.ChecksumSHA256, base64Checksum)
  }

  { // IfNoneMatch option
    const key = 'test/if-match-option'
    const data1 = await testBucket2.putObject(key, 'test', {
      IfNoneMatch: '*',
    })
    const data2 = await testBucket2.getObject(key)
    await assert.rejects(
      () => testBucket2.putObject(key, 'test', {
        IfNoneMatch: '*',
      }),
      { name: 'PreconditionFailed', message: 'At least one of the pre-conditions you specified did not hold', code: 412 },
    )
  }

  { // GrantFullControl, GrantRead, GrantReadACP, GrantWriteACP options
    const key = 'test/grant-read-write-full-control-option'
    await testBucket2.putObject(key, 'test', {
      GrantFullControl: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantRead: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantReadACP: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
      GrantWriteACP: 'uri=http://acs.amazonaws.com/groups/global/AllUsers',
    })
    await testBucket2.getObject(key)
    // no error
  }

  { // ServerSideEncryption, SSEKMSKeyId, SSEKMSEncryptionContext option
    const key = 'test/ServerSideEncryption-SSEKMSKeyId-SSEKMSEncryptionContext-option'
    const encryptionContext = { a: '1' }
    const data1 = await testBucket2.putObject(key, 'test', {
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'alias/presidium-test',
      SSEKMSEncryptionContext: Buffer.from(JSON.stringify(encryptionContext), 'utf8').toString('base64'),
    })
    assert.equal(data1.ServerSideEncryption, 'aws:kms')
    assert.equal(data1.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    const encryptionContext1 = JSON.parse(Buffer.from(data1.SSEKMSEncryptionContext, 'base64').toString('utf8'))
    assert.equal(encryptionContext1.a, '1')
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.ServerSideEncryption, 'aws:kms')
    assert.equal(data2.SSEKMSKeyId, 'arn:aws:kms:us-east-1:095798571722:key/c0bb3d73-0b3f-47c3-8eb6-8567b6d22265')
    const encryptionContext2 = JSON.parse(Buffer.from(data1.SSEKMSEncryptionContext, 'base64').toString('utf8'))
    assert.equal(encryptionContext2.a, '1')
  }

  { // StorageClass option
    const key = 'test/StorageClass-option'
    await testBucket2.putObject(key, 'test', {
      StorageClass: 'REDUCED_REDUNDANCY',
    })
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.StorageClass, 'REDUCED_REDUNDANCY')
  }

  { // WebsiteRedirectLocation option
    const key = 'test/WebsiteRedirectLocation-option'
    const data1 = await testBucket2.putObject(key, 'test', {
      WebsiteRedirectLocation: '/test',
    })
    const data2 = await testBucket2.getObject(key)
    assert.equal(data2.WebsiteRedirectLocation, '/test')
  }

  { // SSECustomerAlgorithm, SSECustomerKey
    const key = 'test/SSECustomerAlgorithm-SSECustomerKey-option'
    const SSECustomerKey = '8spSZEuMkTTwG5Taq1lObxkaJiSOxHmkkPK9Q+WzN5k='
    const SSECustomerKeyMD5 = 'CFvXiGVeD8YIPWCv+UJEBA=='
    const data1 = await testBucket2.putObject(key, 'test', {
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey,
      SSECustomerKeyMD5,
    })
    assert.equal(data1.SSECustomerAlgorithm, 'AES256')
    assert.equal(data1.SSECustomerKeyMD5, SSECustomerKeyMD5)
    const data2 = await testBucket2.getObject(key, {
      SSECustomerAlgorithm: 'AES256',
      SSECustomerKey,
      SSECustomerKeyMD5,
    })
    assert.equal(data2.SSECustomerAlgorithm, 'AES256')
    assert.equal(data2.SSECustomerKeyMD5, SSECustomerKeyMD5)
  }

  testBucket2.closeConnections()
}).case()

const test = Test.all([
  // test1,
  test2,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
