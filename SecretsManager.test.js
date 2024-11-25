const Test = require('thunk-test')
const assert = require('assert')
const AwsCredentials = require('./internal/AwsCredentials')
const SecretsManager = require('./SecretsManager')

const test = new Test('SecretsManager', async function () {
  const awsCreds = await AwsCredentials('default').catch(error => {
    if (error.code == 'ENOENT') {
      const accessKeyId = process.env.AWS_ACCESS_KEY_ID
      const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
      if (accessKeyId == null || secretAccessKey == null) {
        throw new Error('No AWS credential file or environment variables')
      }
      return { accessKeyId, secretAccessKey }
    }
    throw error
  })
  awsCreds.region = 'us-west-1'

  const secretsManager = new SecretsManager({ ...awsCreds })

  const mySecret = {
    name: `test-secret-${Math.trunc(Math.random() * 1e6)}`,
    value: 'helloworld',
  }

  let didRerunTooSoon = false

  try {
    const result = await secretsManager.createSecret(mySecret.name, mySecret.value)
    assert.equal(result.Name, mySecret.name)
  } catch (error) {
    if (error.message.includes('scheduled for deletion')) {
      didRerunTooSoon = true
    } else {
      throw error
    }
  }

  try {
    const result0 = await secretsManager.getSecretValue(mySecret.name)
    assert.equal(result0.Name, mySecret.name)
    assert.equal(result0.SecretString, mySecret.value)

    const result1 = await secretsManager.getSecretString(mySecret.name)
    assert.equal(result1, mySecret.value)
  } catch (error) {
    if (error.message.includes('marked for deletion')) {
      didRerunTooSoon = true
    } else {
      throw error
    }
  }

  {
    const result = await secretsManager.deleteSecret(mySecret.name, mySecret.value)
    assert.equal(result.Name, mySecret.name)
  }

  if (didRerunTooSoon) {
    throw new Error('Reran test too soon, please try in a few seconds')
  }

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
