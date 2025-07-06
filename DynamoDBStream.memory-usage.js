const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBStream = require('./DynamoDBStream')

let maxHeapUsed = 0;

(async function() {
  console.log('initializing dependencies')
  const table = new DynamoDBTable({
    name: 'local-iteration',
    key: [{ iteration: 'number' }],
    endpoint: 'http://localhost:8000',
  })
  await table.ready
  const stream = new DynamoDBStream({
    table: 'local-iteration',
    endpoint: 'http://localhost:8000',
    shardIteratorType: 'TRIM_HORIZON',
    shardUpdatePeriod: 1000
  })
  await stream.ready;
  (async function() {
    for await (const item of stream) {
      console.log('item', item)
    }
  })()
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1))
    const { heapUsed } = process.memoryUsage()
      maxHeapUsed = Math.max(maxHeapUsed, heapUsed)
    console.log('maxHeapUsed (MiB)', heapUsed, maxHeapUsed / 1024 / 1024)
  }
})()
