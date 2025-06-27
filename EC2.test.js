const Test = require('thunk-test')
const assert = require('assert')
const AwsCredentials = require('./internal/AwsCredentials')
const EC2 = require('./EC2')

const test = new Test('EC2', async function () {
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

  const ec2 = new EC2({
    ...awsCreds,
  })

  // there is one test instance in this region

  { // listInstances all instances
    const response = await ec2.listInstances()
    assert(
      response.Instances.filter(instance => instance.State.Name == 'running').length == 0,
      'There should be no instances running'
    )
    assert.equal(response.NextToken, null)
  }

  { // listInstances with tag
    const response = await ec2.listInstances({
      'tag:Env': 'test',
    })
    assert.equal(response.Instances.length, 0)
    assert.equal(response.NextToken, null)
  }

  // terminateInstances with nonexistent instanceId
  await assert.rejects(
    ec2.terminateInstances(['i-055d6f6846eeaaaaa']),
    {
      message: 'The instance ID \'i-055d6f6846eeaaaaa\' does not exist',
      name: 'InvalidInstanceID.NotFound',
    },
  )
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
