require('rubico/global')
const assert = require('assert')
const Test = require('thunk-test')
const AwsCredentials = require('./AwsCredentials')
const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBStream = require('./DynamoDBStream')
const sleep = require('./internal/sleep')

const test1 = new Test('DynamoDBStream', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  const tableName = `my-table-${Date.now()}`

  let table = new DynamoDBTable({
    name: tableName,
    key: [{ id: 'string' }],
    ...awsCreds,
  })
  await table.ready

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
    })
    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'created-stream')
    })
  }

  await table.putItemJSON({
    id: '1',
    status: 'waitlist',
    createTime: 1000,
    name: 'leo',
  })
  await table.putItemJSON({
    id: '2',
    status: 'waitlist',
    createTime: 1001,
    name: 'geo',
  })
  await table.putItemJSON({
    id: '3',
    status: 'waitlist',
    createTime: 1002,
    name: 'john',
  })
  await table.putItemJSON({
    id: '4',
    status: 'approved',
    createTime: 1003,
    name: 'james',
  })
  await table.putItemJSON({
    id: '5',
    status: 'approved',
    createTime: 1004,
    name: 'sally',
  })

  await table.updateItemJSON({ id: '1' }, { a: 1 })
  await table.updateItemJSON({ id: '2' }, { a: 2 })
  await table.updateItemJSON({ id: '3' }, { a: 3 })
  await table.updateItemJSON({ id: '4' }, { a: 4 })
  await table.updateItemJSON({ id: '5' }, { a: 5 })

  await table.deleteItemJSON({ id: '1' })
  await table.deleteItemJSON({ id: '2' })
  await table.deleteItemJSON({ id: '3' })
  await table.deleteItemJSON({ id: '4' })
  await table.deleteItemJSON({ id: '5' })

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      ShardIteratorType: 'TRIM_HORIZON',
      ShardUpdatePeriod: 1000,
    })

    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'stream-exists')
    })

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 15) {
        break
      }
    }

    assert.equal(streamItems.length, 15)

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')
    const removeItems = streamItems.filter(item => item.eventName == 'REMOVE')

    insertItems.sort((a, b) => (
      Number(a.dynamodb.NewImage.createTime.N) - Number(b.dynamodb.NewImage.createTime.N)
    ))
    modifyItems.sort((a, b) => (
      Number(a.dynamodb.NewImage.createTime.N) - Number(b.dynamodb.NewImage.createTime.N)
    ))
    removeItems.sort((a, b) => (
      Number(a.dynamodb.OldImage.createTime.N) - Number(b.dynamodb.OldImage.createTime.N)
    ))

    assert.equal(insertItems.length, 5)
    assert.equal(modifyItems.length, 5)
    assert.equal(removeItems.length, 5)

    assert.equal(insertItems[0].dynamodb.NewImage.id.S, '1')
    assert.equal(insertItems[1].dynamodb.NewImage.id.S, '2')
    assert.equal(insertItems[2].dynamodb.NewImage.id.S, '3')
    assert.equal(insertItems[3].dynamodb.NewImage.id.S, '4')
    assert.equal(insertItems[4].dynamodb.NewImage.id.S, '5')

    assert(insertItems[0].dynamodb.OldImage == null)
    assert(insertItems[1].dynamodb.OldImage == null)
    assert(insertItems[2].dynamodb.OldImage == null)
    assert(insertItems[3].dynamodb.OldImage == null)
    assert(insertItems[4].dynamodb.OldImage == null)

    assert.equal(modifyItems[0].dynamodb.NewImage.id.S, '1')
    assert.equal(modifyItems[1].dynamodb.NewImage.id.S, '2')
    assert.equal(modifyItems[2].dynamodb.NewImage.id.S, '3')
    assert.equal(modifyItems[3].dynamodb.NewImage.id.S, '4')
    assert.equal(modifyItems[4].dynamodb.NewImage.id.S, '5')

    assert.equal(modifyItems[0].dynamodb.OldImage.id.S, '1')
    assert.equal(modifyItems[1].dynamodb.OldImage.id.S, '2')
    assert.equal(modifyItems[2].dynamodb.OldImage.id.S, '3')
    assert.equal(modifyItems[3].dynamodb.OldImage.id.S, '4')
    assert.equal(modifyItems[4].dynamodb.OldImage.id.S, '5')

    assert(removeItems[0].dynamodb.NewImage == null)
    assert(removeItems[1].dynamodb.NewImage == null)
    assert(removeItems[2].dynamodb.NewImage == null)
    assert(removeItems[3].dynamodb.NewImage == null)
    assert(removeItems[4].dynamodb.NewImage == null)

    assert.equal(removeItems[0].dynamodb.OldImage.id.S, '1')
    assert.equal(removeItems[1].dynamodb.OldImage.id.S, '2')
    assert.equal(removeItems[2].dynamodb.OldImage.id.S, '3')
    assert.equal(removeItems[3].dynamodb.OldImage.id.S, '4')
    assert.equal(removeItems[4].dynamodb.OldImage.id.S, '5')

    myStream.close()
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      GetRecordsLimit: 1,
      GetRecordsInterval: 1000,
      ShardUpdatePeriod: 1000,
      ShardIteratorType: 'TRIM_HORIZON',
      JSON: true,
    })

    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'stream-exists')
    })

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 15) {
        break
      }
    }

    assert.equal(streamItems.length, 15)

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')
    const removeItems = streamItems.filter(item => item.eventName == 'REMOVE')

    insertItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    modifyItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    removeItems.sort((a, b) => (
      a.dynamodb.OldImageJSON.createTime - b.dynamodb.OldImageJSON.createTime
    ))

    assert.equal(insertItems.length, 5)
    assert.equal(modifyItems.length, 5)
    assert.equal(removeItems.length, 5)

    assert.strictEqual(insertItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(insertItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(insertItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(insertItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(insertItems[4].dynamodb.NewImageJSON.id, '5')

    assert(insertItems[0].dynamodb.OldImageJSON == null)
    assert(insertItems[1].dynamodb.OldImageJSON == null)
    assert(insertItems[2].dynamodb.OldImageJSON == null)
    assert(insertItems[3].dynamodb.OldImageJSON == null)
    assert(insertItems[4].dynamodb.OldImageJSON == null)

    assert.strictEqual(modifyItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.NewImageJSON.id, '5')

    assert.strictEqual(modifyItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.OldImageJSON.id, '5')

    assert(removeItems[0].dynamodb.NewImageJSON == null)
    assert(removeItems[1].dynamodb.NewImageJSON == null)
    assert(removeItems[2].dynamodb.NewImageJSON == null)
    assert(removeItems[3].dynamodb.NewImageJSON == null)
    assert(removeItems[4].dynamodb.NewImageJSON == null)

    assert.strictEqual(removeItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(removeItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(removeItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(removeItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(removeItems[4].dynamodb.OldImageJSON.id, '5')

    myStream.close()
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      GetRecordsLimit: 1,
      ShardUpdatePeriod: 1000,
      ShardIteratorType: 'TRIM_HORIZON',
      JSON: true,
    })
    await myStream.ready

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 15) {
        break
      }
    }

    assert.equal(streamItems.length, 15)

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')
    const removeItems = streamItems.filter(item => item.eventName == 'REMOVE')

    insertItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    modifyItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    removeItems.sort((a, b) => (
      a.dynamodb.OldImageJSON.createTime - b.dynamodb.OldImageJSON.createTime
    ))

    assert.equal(insertItems.length, 5)
    assert.equal(modifyItems.length, 5)
    assert.equal(removeItems.length, 5)

    assert.strictEqual(insertItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(insertItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(insertItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(insertItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(insertItems[4].dynamodb.NewImageJSON.id, '5')

    assert(insertItems[0].dynamodb.OldImageJSON == null)
    assert(insertItems[1].dynamodb.OldImageJSON == null)
    assert(insertItems[2].dynamodb.OldImageJSON == null)
    assert(insertItems[3].dynamodb.OldImageJSON == null)
    assert(insertItems[4].dynamodb.OldImageJSON == null)

    assert.strictEqual(modifyItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.NewImageJSON.id, '5')

    assert.strictEqual(modifyItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.OldImageJSON.id, '5')

    assert(removeItems[0].dynamodb.NewImageJSON == null)
    assert(removeItems[1].dynamodb.NewImageJSON == null)
    assert(removeItems[2].dynamodb.NewImageJSON == null)
    assert(removeItems[3].dynamodb.NewImageJSON == null)
    assert(removeItems[4].dynamodb.NewImageJSON == null)

    assert.strictEqual(removeItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(removeItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(removeItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(removeItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(removeItems[4].dynamodb.OldImageJSON.id, '5')

    myStream.close()
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      ListStreamsLimit: 1,
      ShardUpdatePeriod: 1000,
      ShardIteratorType: 'TRIM_HORIZON',
      JSON: true,
    })
    await myStream.ready

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 15) {
        break
      }
    }

    assert.equal(streamItems.length, 15)

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')
    const removeItems = streamItems.filter(item => item.eventName == 'REMOVE')

    insertItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    modifyItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    removeItems.sort((a, b) => (
      a.dynamodb.OldImageJSON.createTime - b.dynamodb.OldImageJSON.createTime
    ))

    assert.equal(insertItems.length, 5)
    assert.equal(modifyItems.length, 5)
    assert.equal(removeItems.length, 5)

    assert.strictEqual(insertItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(insertItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(insertItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(insertItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(insertItems[4].dynamodb.NewImageJSON.id, '5')

    assert(insertItems[0].dynamodb.OldImageJSON == null)
    assert(insertItems[1].dynamodb.OldImageJSON == null)
    assert(insertItems[2].dynamodb.OldImageJSON == null)
    assert(insertItems[3].dynamodb.OldImageJSON == null)
    assert(insertItems[4].dynamodb.OldImageJSON == null)

    assert.strictEqual(modifyItems[0].dynamodb.NewImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.NewImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.NewImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.NewImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.NewImageJSON.id, '5')

    assert.strictEqual(modifyItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(modifyItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(modifyItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(modifyItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(modifyItems[4].dynamodb.OldImageJSON.id, '5')

    assert(removeItems[0].dynamodb.NewImageJSON == null)
    assert(removeItems[1].dynamodb.NewImageJSON == null)
    assert(removeItems[2].dynamodb.NewImageJSON == null)
    assert(removeItems[3].dynamodb.NewImageJSON == null)
    assert(removeItems[4].dynamodb.NewImageJSON == null)

    assert.strictEqual(removeItems[0].dynamodb.OldImageJSON.id, '1')
    assert.strictEqual(removeItems[1].dynamodb.OldImageJSON.id, '2')
    assert.strictEqual(removeItems[2].dynamodb.OldImageJSON.id, '3')
    assert.strictEqual(removeItems[3].dynamodb.OldImageJSON.id, '4')
    assert.strictEqual(removeItems[4].dynamodb.OldImageJSON.id, '5')

    myStream.close()
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      ShardUpdatePeriod: 1000,
      // ShardIteratorType: LATEST (default)
    })
    await myStream.ready

    // there shouldn't be any more records, so this should hang
    const latestRecordPromise1 = (async () => {
      for await (const streamItem of myStream) {
        return streamItem
      }
    })()
    const raceResult1 = await Promise.race([
      latestRecordPromise1,
      new Promise(resolve => setTimeout(thunkify(resolve, 'test'), 3000))
    ])
    assert.equal(raceResult1, 'test')

    // wait a second for shard update
    await new Promise(resolve => setTimeout(thunkify(resolve, 'test'), 1000))

    // there shouldn't be any more records after shard update, so this should hang
    const latestRecordPromise2 = (async () => {
      for await (const streamItem of myStream) {
        return streamItem
      }
    })()
    const raceResult2 = await Promise.race([
      latestRecordPromise2,
      new Promise(resolve => setTimeout(thunkify(resolve, 'test'), 3000))
    ])
    assert.equal(raceResult2, 'test')

    myStream.close()
  }

  { // concurrent init
    console.log('Testing 5 concurrent stream inits...')
    const targetNumStreams = 5
    const streams = []
    const promises = []
    while (streams.length < targetNumStreams) {
      const stream = new DynamoDBStream({
        table: tableName,
        ...awsCreds,
        GetStreamsInterval: 1000,
        GetShardsInterval: 1000,
        GetRecordsInterval: 1000,
        ListStreamsLimit: 1,
        ShardIteratorType: 'TRIM_HORIZON',
        Debug: true,
        ShardUpdatePeriod: 5000,
      })

      promises.push(stream.ready.then(async () => {
        for await (const item of stream) {
          // consume item
        }
      }))

      streams.push(stream)
    }
    await Promise.race([
      sleep(10000),
      Promise.all(promises),
    ])

    streams.forEach(stream => stream.close())
  }

  {
    await table.delete()
    table = new DynamoDBTable({
      name: tableName,
      key: [{ id: 'string' }],
      ...awsCreds,
    })
    await table.ready
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
    })
    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'created-stream')
    })
  }

  await table.delete()

}).case()

const test = Test.all([
  test1,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
