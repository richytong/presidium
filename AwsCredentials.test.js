const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const AwsCredentials = require('./AwsCredentials')

const test = new Test('AwsCredentials', async function integration() {
  const credentialsFilename = 'credentials-test'
  const credentialsFileDirname = '.aws-test'

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
  `.trim())

  {
    const awsCreds = await AwsCredentials('presidium', {
      credentialsFileDirname,
      credentialsFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'AAA')
    assert.equal(awsCreds.secretAccessKey, 'BBB')
  }

  {
    const awsCreds = await AwsCredentials('default', {
      credentialsFileDirname,
      credentialsFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'X1')
    assert.equal(awsCreds.secretAccessKey, 'X2')
  }

  {
    const awsCreds = await AwsCredentials(undefined, {
      credentialsFileDirname,
      credentialsFilename,
    })
    assert.equal(awsCreds.accessKeyId, 'X1')
    assert.equal(awsCreds.secretAccessKey, 'X2')
  }

  {
    await assert.rejects(
      async () => {
        await AwsCredentials('missing-access-key-id', {
          credentialsFileDirname,
          credentialsFilename,
        })
      },
      new Error('unable to find aws_access_key_id for profile missing-access-key-id')
    )
  }

  {
    await assert.rejects(
      async () => {
        await AwsCredentials('missing-secret-access-key', {
          credentialsFileDirname,
          credentialsFilename,
        })
      },
      new Error('unable to find aws_secret_access_key for profile missing-secret-access-key')
    )
  }

  await fs.promises.rm(`${__dirname}/../${credentialsFileDirname}`, { recursive: true })

  await assert.rejects(
    AwsCredentials('presidium', {
      credentialsFileDirname,
      credentialsFilename,
      recurse: false,
    }),
    new Error('Missing .aws/credentials file')
  )

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
