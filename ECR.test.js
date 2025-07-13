const Test = require('thunk-test')
const assert = require('assert')
const ECR = require('./ECR')
const AwsCredentials = require('./internal/AwsCredentials')

const test = new Test('ECR', async function integration() {
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

  const ecr = new ECR({
    ...awsCreds,
  })

  // clean
  await ecr.deleteRepository('test-repo/p1').catch(() => {})

  {
    const response = await ecr.createRepository('test-repo/p1', {
      tags: [{ Key: 'a', Value: '1' }],
      imageTagMutability: 'IMMUTABLE',
      imageScanningConfiguration: {
        scanOnPush: true
      },
      encryptionConfiguration: {
        encryptionType: 'AES256',
      }
    })
    assert.equal(response.repository.repositoryName, 'test-repo/p1')
    assert.equal(response.repository.imageTagMutability, 'IMMUTABLE')
    assert.equal(response.repository.imageScanningConfiguration.scanOnPush, true)
    assert.equal(response.repository.encryptionConfiguration.encryptionType, 'AES256')
  }

  {
    const response = await ecr.deleteRepository('test-repo/p1')
    assert.equal(response.repository.repositoryName, 'test-repo/p1')
    assert.equal(response.repository.imageTagMutability, 'IMMUTABLE')
  }

  const authorizationToken = await ecr.getAuthorizationToken()
  assert.equal(typeof authorizationToken, 'string')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
