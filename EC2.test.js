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

  { // listInstances E2E
    const response = await ec2.listInstances({
      'tag:aws:autoscaling:groupName': [
        'production-manager',
        'production-hub',
        'production-members-hub',
        'production-moderator-hub',
      ],
    })
    assert.equal(response.Instances.length, 0)
    assert.equal(response.NextToken, null)
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
