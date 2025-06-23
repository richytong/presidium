const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const AwsCredentials = require('./AwsCredentials')

const test = new Test('AwsCredentials', async function () {
  const credentialsFilename = 'credentials-test'
  const credentialsFileDirname = '.aws-test'
  const configFilename = 'config-test'
  const configFileDirname = credentialsFileDirname

  try {
    await fs.promises.mkdir(`${__dirname}/../${credentialsFileDirname}`)
  } catch {
    await fs.promises.rm(`${__dirname}/../${credentialsFileDirname}`, { recursive: true })
    await fs.promises.mkdir(`${__dirname}/../${credentialsFileDirname}`)
  }

  await fs.promises.writeFile(`${__dirname}/../${credentialsFileDirname}/${credentialsFilename}`, `
[default]
aws_access_key_id = X1
aws_secret_access_key = X2

[presidium]
aws_access_key_id = AAA
aws_secret_access_key = BBB
  `.trim())

  await fs.promises.writeFile(`${__dirname}/../${configFileDirname}/${configFilename}`, `
[default]
region = us-east-default

[presidium]
region = us-east-presidium
  `.trim())

  {
    const awsCreds = await AwsCredentials('presidium', {
      credentialsFileDirname,
      credentialsFilename,
      configFileDirname,
      configFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'AAA')
    assert.equal(awsCreds.secretAccessKey, 'BBB')
    assert.equal(awsCreds.region, 'us-east-presidium')
  }

  {
    const awsCreds = await AwsCredentials('default', {
      credentialsFileDirname,
      credentialsFilename,
      configFileDirname,
      configFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'X1')
    assert.equal(awsCreds.secretAccessKey, 'X2')
    assert.equal(awsCreds.region, 'us-east-default')
  }

  {
    const awsCreds = await AwsCredentials(undefined, {
      credentialsFileDirname,
      credentialsFilename,
      configFileDirname,
      configFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'X1')
    assert.equal(awsCreds.secretAccessKey, 'X2')
    assert.equal(awsCreds.region, 'us-east-default')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = 'AAAA'
    process.env.AWS_SECRET_ACCESS_KEY = 'BBBB'
    process.env.AWS_REGION = 'CCCC'
    const awsCreds = await AwsCredentials('presidium', {
      credentialsFileDirname,
      credentialsFilename,
      configFileDirname,
      configFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'AAAA')
    assert.equal(awsCreds.secretAccessKey, 'BBBB')
    assert.equal(awsCreds.region, 'CCCC')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = 'AAAA'
    process.env.AWS_SECRET_ACCESS_KEY = 'BBBB'
    delete process.env.AWS_REGION
    const awsCreds = await AwsCredentials('presidium', {
      credentialsFileDirname,
      credentialsFilename,
      configFileDirname,
      configFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'AAAA')
    assert.equal(awsCreds.secretAccessKey, 'BBBB')
    assert.equal(awsCreds.region, undefined)
  }

  await fs.promises.rm(`${__dirname}/../${credentialsFileDirname}`, { recursive: true })
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
