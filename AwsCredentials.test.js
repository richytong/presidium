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

[missing-access-key-id]
aws_secret_access_key = BBB

[missing-secret-access-key]
aws_access_key_id = AAA

[missing-region]
aws_access_key_id = AAA
aws_secret_access_key = BBB
  `.trim())

  await fs.promises.writeFile(`${__dirname}/../${configFileDirname}/${configFilename}`, `
[default]
region = us-east-default

[presidium]
region = us-east-presidium

[missing-access-key-id]
region = us-east-missing-access-key-id

[missing-secret-access-key]
region = us-east-missing-secret-access-key
  `.trim())

  {
    delete process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    delete process.env.AWS_REGION
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
    await assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials('missing-access-key-id', {
          credentialsFileDirname,
          credentialsFilename,
          configFileDirname,
          configFilename,
        })
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find aws_access_key_id for profile missing-access-key-id')
    )
  }

  {
    await assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials('missing-secret-access-key', {
          credentialsFileDirname,
          credentialsFilename,
          configFileDirname,
          configFilename,
        })
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find aws_secret_access_key for profile missing-secret-access-key')
    )
  }

  {
    await assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials('missing-region', {
          credentialsFileDirname,
          credentialsFilename,
          configFileDirname,
          configFilename,
        })
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find region for profile missing-region')
    )
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
    // process.env.AWS_ACCESS_KEY_ID
    // process.env.AWS_SECRET_ACCESS_KEY = 'BBBB'
    delete process.env.AWS_REGION
    assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials()
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find AWS_REGION in env')
    )
  }

  {
    // process.env.AWS_ACCESS_KEY_ID
    delete process.env.AWS_SECRET_ACCESS_KEY
    assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials()
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find AWS_SECRET_ACCESS_KEY in env')
    )
  }

  {
    process.env.AWS_REGION = 'us-east-test'
    delete process.env.AWS_ACCESS_KEY_ID
    assert.rejects(
      async () => {
        const awsCreds = await AwsCredentials()
        console.error('awsCreds', awsCreds)
      },
      new Error('unable to find AWS_ACCESS_KEY_ID in env')
    )
  }

  await fs.promises.rm(`${__dirname}/../${credentialsFileDirname}`, { recursive: true })
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
