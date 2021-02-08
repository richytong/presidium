const DynamoTable = require('./DynamoTable')
const DynamoStream = require('./DynamoStream')

let maxHeapUsed = 0

const logMaxHeapUsed = function () {
}

;(async function() {
  console.log('initializing dependencies')
  const table = new DynamoTable({
    name: 'local-iteration',
    key: [{ iteration: 'number' }],
    endpoint: 'http://localhost:8000',
  })
  await table.ready
  const stream = new DynamoStream({
    table: 'local-iteration',
    endpoint: 'http://localhost:8000',
    shardIteratorType: 'TRIM_HORIZON',
  })
  console.log('stream', stream)
  await stream.ready;
  (async function() {
    for await (const item of stream) {
      console.log('item', item)
        /*
      await table.putItem({
        iteration: Number(item.dynamodb.NewImage.iteration.N) + 1,
      })
      */
    }
  })()
  let iteration = 0
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1))
    const { heapUsed } = process.memoryUsage()
      maxHeapUsed = Math.max(maxHeapUsed, heapUsed)
    console.log('maxHeapUsed (MiB)', heapUsed, maxHeapUsed / 1024 / 1024)
    // await table.putItem({ iteration })
  }
  // maxHeapUsed goes up every ~5mins
})()
