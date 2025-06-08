const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const AwsCredentials = require('./AwsCredentials')

const test = new Test('AwsCredentials', async function () {
  const credentialsFilename = 'credentials-test'

  try {
    await fs.promises.mkdir(`${__dirname}/../.aws`)
  } catch {
    await fs.promises.rm(`${__dirname}/../.aws`, { recursive: true })
    await fs.promises.mkdir(`${__dirname}/../.aws`)
  }

  await fs.promises.writeFile(`${__dirname}/../.aws/${credentialsFilename}`, `
[default]
aws_access_key_id = X
aws_secret_access_key = X

[presidium]
aws_access_key_id = AAA
aws_secret_access_key = BBB
  `.trim())

  {
    const awsCreds = await AwsCredentials('presidium', { credentialsFilename })
    assert.equal(awsCreds.secretAccessKey, 'BBB')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = 'AAAA'
    process.env.AWS_SECRET_ACCESS_KEY = 'BBBB'
    const awsCreds = await AwsCredentials('presidium', { credentialsFilename })
    assert.equal(awsCreds.accessKeyId, 'AAAA')
    assert.equal(awsCreds.secretAccessKey, 'BBBB')
  }

  {
    process.env.AWS_ACCESS_KEY_ID = 'AAAA'
    process.env.AWS_SECRET_ACCESS_KEY = 'BBBB'
    process.env.AWS_REGION = 'us-east-2'
    const awsCreds = await AwsCredentials('presidium', { credentialsFilename })
    assert.equal(awsCreds.accessKeyId, 'AAAA')
    assert.equal(awsCreds.secretAccessKey, 'BBBB')
    assert.equal(awsCreds.region, 'us-east-2')
  }

  await fs.promises.rm(`${__dirname}/../.aws`, { recursive: true })
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
