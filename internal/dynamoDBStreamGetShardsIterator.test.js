const Test = require('thunk-test')
const assert = require('assert')
const stream = require('stream')
const dynamoDBStreamGetShardsIterator = require('./dynamoDBStreamGetShardsIterator')

const test = new Test('dynamoDBStreamGetShardsIterator', async function integration() {

  let numRequests = 0
  const dynamoDBStream = {
    GetShardsInterval: 100,

    _awsDynamoDBStreamsRequest() {
      if (numRequests < 3) {
        numRequests += 1
        const response = stream.Readable.from([JSON.stringify({ StreamDescription: { Shards: [{}], LastEvaluatedShardId: 'test' } })])
        response.headers = {}
        response.ok = true
        return response
      }
      const response = stream.Readable.from([JSON.stringify({ StreamDescription: { Shards: [{}] } })])
      response.headers = {}
      response.ok = true
      return response
    }
  }

  const iter = dynamoDBStreamGetShardsIterator.call(dynamoDBStream, { StreamArn: 'test' })

  const shards = []
  for await (const Shard of iter) {
    shards.push(Shard)
  }
  assert.equal(shards.length, 4)

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
