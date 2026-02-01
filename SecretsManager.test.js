const Test = require('thunk-test')
const assert = require('assert')
const AwsCredentials = require('./AwsCredentials')
const SecretsManager = require('./SecretsManager')

const test = new Test('SecretsManager', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  const secretsManager = new SecretsManager({ ...awsCreds })

  const mySecret = {
    name: `test-secret-${Math.trunc(Math.random() * 1e6)}`,
    value: 'helloworld',
  }

  let didRerunTooSoon = false

  try {
    const result0 = await secretsManager.putSecret(mySecret.name, mySecret.value)
    assert.equal(result0.Name, mySecret.name)

    mySecret.value = 'helloworld2'

    // should update
    const result1 = await secretsManager.putSecret(mySecret.name, mySecret.value)
    assert.equal(result1.Name, mySecret.name)
  } catch (error) {
    if (error.message.includes('scheduled for deletion')) {
      didRerunTooSoon = true
    } else {
      throw error
    }
  }

  try {
    const result0 = await secretsManager.getSecret(mySecret.name)
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
