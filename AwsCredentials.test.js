const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const AwsCredentials = require('./AwsCredentials')

const test = new Test('AwsCredentials', async function () {
  try {
    await fs.promises.mkdir(`${__dirname}/../.aws`)
  } catch {
    await fs.promises.rm(`${__dirname}/../.aws`, { recursive: true })
    await fs.promises.mkdir(`${__dirname}/../.aws`)
  }

  await fs.promises.writeFile(`${__dirname}/../.aws/credentials`, `
[default]
aws_access_key_id = ***
aws_secret_access_key = ***
  `.trim())

  {
    const awsCreds = await AwsCredentials('default')
    console.log('awsCreds', awsCreds)
    assert.equal(awsCreds.accessKeyId, '***')
    assert.equal(awsCreds.secretAccessKey, '***')
  }

  {
    const awsCreds = await AwsCredentials({ profile: 'default' })
    assert.equal(awsCreds.accessKeyId, '***')
    assert.equal(awsCreds.secretAccessKey, '***')
  }

  {
    const awsCreds = await AwsCredentials()
    assert.equal(awsCreds.accessKeyId, '***')
    assert.equal(awsCreds.secretAccessKey, '***')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = '****'
    process.env.AWS_SECRET_ACCESS_KEY = '****'
    const awsCreds = await AwsCredentials()
    assert.equal(awsCreds.accessKeyId, '****')
    assert.equal(awsCreds.secretAccessKey, '****')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = '****'
    process.env.AWS_SECRET_ACCESS_KEY = '****'
    process.env.AWS_REGION = 'us-east-2'
    const awsCreds = await AwsCredentials()
    assert.equal(awsCreds.accessKeyId, '****')
    assert.equal(awsCreds.secretAccessKey, '****')
    assert.equal(awsCreds.region, 'us-east-2')
  }

  await fs.promises.rm(`${__dirname}/../.aws`, { recursive: true })
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
