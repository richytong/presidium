const Test = require('thunk-test')
const assert = require('assert')
const ECR = require('./ECR')
const AwsCredentials = require('./AwsCredentials')
const Docker = require('./Docker')

const test = new Test('ECR', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'
  const awsAccountId = '141814482060'

  const ecr = new ECR({ ...awsCreds })

  await ecr.deleteRepository('test-repo/p1', { force: true }).catch(() => {})

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

  const authorizationToken = await ecr.getAuthorizationToken()
  assert.equal(typeof authorizationToken, 'string')

  const docker = new Docker({ apiVersion: '1.44' })

  { // pull node-15:alpine
    const dataStream = await docker.pullImage('node:15-alpine')
    dataStream.pipe(process.stdout)
    await new Promise(resolve => dataStream.on('end', resolve))
  }

  {
    const dataStream = await docker.buildImage(__dirname, {
      image: 'test-repo/p1:test',
      archive: {
        Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8888`,
      },
    })
    dataStream.pipe(process.stdout)
    await new Promise(resolve => {
      dataStream.on('end', resolve)
    })

    dataStream.on('data', chunk => {
      const line = chunk.toString('utf8')
      if (line.startsWith('{"error')) {
        throw new Error(line)
      }
    })
  }

  {
    const data = await docker.tagImage(
      'test-repo/p1:test',
      `${awsAccountId}.dkr.ecr.${awsCreds.region}.amazonaws.com/test-repo/p1:test`,
    )
    assert.equal(Object.keys(data).length, 0)
  }

  {
    const dataStream = await docker.pushImage({
      image: 'test-repo/p1:test',
      registry: `${awsAccountId}.dkr.ecr.${awsCreds.region}.amazonaws.com`,
      authToken: authorizationToken,
    })
    dataStream.pipe(process.stdout)
    await new Promise(resolve => {
      dataStream.on('end', resolve)
    })

    dataStream.on('data', chunk => {
      const line = chunk.toString('utf8')
      if (line.startsWith('{"error')) {
        throw new Error(line)
      }
    })
  }

  {
    await assert.rejects(
      ecr.deleteRepository('test-repo/p1'),
      error => {
        assert.equal(error.name, 'RepositoryNotEmptyException')
        assert(error.message.includes('cannot be deleted because it still contains images'))
        return true
      }
    )
  }

  {
    const response = await ecr.deleteRepository('test-repo/p1', { force: true })
    assert.equal(response.repository.repositoryName, 'test-repo/p1')
    assert.equal(response.repository.imageTagMutability, 'IMMUTABLE')
  }

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
