const DynamoDBTable = require('./DynamoDBTable')
const S3Bucket = require('./S3Bucket')
const AwsCredentials = require('./AwsCredentials')

setImmediate(async () => {
  const awsCreds = await AwsCredentials('presidium')

  /*
  const table = new DynamoDBTable({
    name: 'production_service',
    key: [{ serviceName: 'string' }, { swarmName: 'string' }],
    autoReady: false,
    ...awsCreds
  })
  await table.exists()
  */

  awsCreds.region = 'us-west-1'
  const bucket = new S3Bucket({
    name: 'test-bucket-presidium-asdf-2',
    autoReady: false,
    ...awsCreds
  })
  console.log(bucket)
  await bucket.getLocation()
  const data = await bucket.delete()
  console.log(data)

})
