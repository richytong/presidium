const assert = require('assert')
const AwsError = require('./AwsError')

describe('AwsError', () => {
  it('Creates error for XML message', async () => {
    const xml = `
<?xml version="1.0" encoding="UTF-8"?>
<Error><Code>BucketAlreadyOwnedByYou</Code><Message>Your previous request to create the named bucket succeeded and you already own it.</Message><BucketName>test-bucket-presidium-1</BucketName><RequestId>305P3CJFMWQNB511</RequestId><HostId>ziqHCuXZM21Woaa2JFRZrujuE5GbsGGGJYWAM2lMFHvm1WU05mw8XC0OnoP75h8xZqnZUQNkqPiw40QhFlZy43EbcCRXUrMwfjbT9XVbnA8=</HostId></Error>
    `.trim()
    const error = new AwsError(xml)
    assert.equal(error.name, 'BucketAlreadyOwnedByYou')
    assert.equal(error.message, 'Your previous request to create the named bucket succeeded and you already own it.')
  })

  it('Creates error for JSON message', async () => {
    const message = JSON.stringify({
      __type: 'com.test.presidium#TestError',
      Message: 'test'
    })
    const error = new AwsError(message)
    assert.equal(error.name, 'TestError')
    assert.equal(error.message, 'test')
  })

  it('Creates error for basic message', async () => {
    const message = 'test'
    const error = new AwsError(message)
    assert.equal(error.name, 'AwsError')
    assert.equal(error.message, 'test')
  })
})
