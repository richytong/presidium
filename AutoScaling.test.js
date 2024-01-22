const Test = require('thunk-test')
const assert = require('assert')
const AwsCredentials = require('./internal/AwsCredentials')
const AutoScaling = require('./AutoScaling')

const test = new Test('AutoScaling', async function () {
  const awsCreds = await AwsCredentials('solum').catch(error => {
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

  const autoScaling = new AutoScaling({
    ...awsCreds,
  })

  // there is one auto scaling group named presidium-test with one ec2 instance in this region

  { // listInstances all instances
    const response = await autoScaling.listAutoScalingGroups()
    assert(
      response.AutoScalingGroups.map(group => group.AutoScalingGroupName).includes('presidium-test'),
      'There is no presidium-test autoscaling group, check the aws account'
    )
    assert.equal(response.NextToken, null)
  }

  { // listAutoScalingGroups with tag
    const response = await autoScaling.listAutoScalingGroups({
      'tag:Env': 'test',
    })
    assert(
      response.AutoScalingGroups.map(group => group.AutoScalingGroupName).includes('presidium-test'),
      'There is no autoscaling group with tag:Env = test, check the aws account'
    )
    assert.equal(response.NextToken, null)
  }

  // setDesiredCapacity (errors if not auto scaling group not found)
  await autoScaling.setDesiredCapacity({
    autoScalingGroupName: 'presidium-test',
    desiredCapacity: 0,
  })
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
