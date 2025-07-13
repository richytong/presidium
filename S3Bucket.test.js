const assert = require('assert')
const Test = require('thunk-test')
const _S3 = require('./internal/_S3')
const S3Bucket = require('./S3Bucket')

const test = new Test('S3Bucket', (...args) => new S3Bucket(...args))

.before(async function () {
  this._s3 = new _S3({
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin',
    endpoint: 'http://localhost:9000',
  })
  try {
    await new S3Bucket({
      name: 'test-bucket',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      endpoint: 'http://localhost:9000',
    }).deleteAllObjects()
    await this._s3.deleteBucket('test-bucket')
  } catch {}
})

.case({
  name: 'test-bucket',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  endpoint: 'http://localhost:9000/',
}, async function (testBucket) {
  await testBucket.ready

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
  await testBucket.putObject('binary', Buffer.from('binary'))
  const binary = await testBucket.getObject('binary')
  assert(binary.ContentType == 'application/octet-stream')
  assert.deepEqual(binary.Body, Buffer.from('binary'))

  const res = await testBucket.upload('buffer', Buffer.from('buffer'))
  const buffer = await testBucket.getObject('buffer')
  assert(buffer.ContentType == 'application/octet-stream')
  assert.deepEqual(buffer.Body, Buffer.from('buffer'))

  {
    const key = 'buffer2'
    await testBucket.upload(key, Buffer.from('buffer'))
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
    console.log(response)
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
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
