require('rubico/global')
const assert = require('assert')
const Test = require('thunk-test')
const AwsCredentials = require('./AwsCredentials')
const DynamoDBTable = require('./DynamoDBTable')
const DynamoDBStream = require('./DynamoDBStream')

const test1 = new Test('DynamoDBStream', async function integration() {
  const awsCreds = await AwsCredentials('presidium')
  awsCreds.region = 'us-east-1'

  const tableName = `my-table-${Date.now()}`
  {
    const table = new DynamoDBTable({
      name: tableName,
      key: [{ id: 'string' }],
      ...awsCreds,
      autoReady: false,
    })
    await table.delete().catch(() => {})
  }

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
      ShardIteratorType: 'TRIM_HORIZON',
      ShardUpdatePeriod: 1000,
    })
    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'created-stream')
    })

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
      name: 'sally',
    })
    await table.putItemJSON({
      id: '5',
      status: 'approved',
      createTime: 1004,
      name: 'sally',
    })

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 5) {
        break
      }
    }
    streamItems.sort((a, b) => (
      Number(a.dynamodb.NewImage.createTime.N)
        - Number(b.dynamodb.NewImage.createTime.N)
    ))
    assert.equal(streamItems[0].dynamodb.NewImage.id.S, '1')
    assert.equal(streamItems[1].dynamodb.NewImage.id.S, '2')
    assert.equal(streamItems[2].dynamodb.NewImage.id.S, '3')
    assert.equal(streamItems[3].dynamodb.NewImage.id.S, '4')
    assert.equal(streamItems[4].dynamodb.NewImage.id.S, '5')

    assert(streamItems[0].dynamodb.OldImage == null)
    assert(streamItems[1].dynamodb.OldImage == null)
    assert(streamItems[2].dynamodb.OldImage == null)
    assert(streamItems[3].dynamodb.OldImage == null)
    assert(streamItems[4].dynamodb.OldImage == null)

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
      if (streamItems.length == 5) {
        break
      }
    }
    streamItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    assert.equal(streamItems[0].dynamodb.NewImageJSON.id, '1')
    assert.equal(streamItems[1].dynamodb.NewImageJSON.id, '2')
    assert.equal(streamItems[2].dynamodb.NewImageJSON.id, '3')
    assert.equal(streamItems[3].dynamodb.NewImageJSON.id, '4')
    assert.equal(streamItems[4].dynamodb.NewImageJSON.id, '5')

    assert(streamItems[0].dynamodb.OldImageJSON == null)
    assert(streamItems[1].dynamodb.OldImageJSON == null)
    assert(streamItems[2].dynamodb.OldImageJSON == null)
    assert(streamItems[3].dynamodb.OldImageJSON == null)
    assert(streamItems[4].dynamodb.OldImageJSON == null)

    assert(streamItems[0].dynamodb.NewImage == null)
    assert(streamItems[1].dynamodb.NewImage == null)
    assert(streamItems[2].dynamodb.NewImage == null)
    assert(streamItems[3].dynamodb.NewImage == null)
    assert(streamItems[4].dynamodb.NewImage == null)

    assert(streamItems[0].dynamodb.OldImage == null)
    assert(streamItems[1].dynamodb.OldImage == null)
    assert(streamItems[2].dynamodb.OldImage == null)
    assert(streamItems[3].dynamodb.OldImage == null)
    assert(streamItems[4].dynamodb.OldImage == null)

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
      if (streamItems.length == 5) {
        break
      }
    }
    streamItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))
    assert.equal(streamItems[0].dynamodb.NewImageJSON.id, '1')
    assert.equal(streamItems[1].dynamodb.NewImageJSON.id, '2')
    assert.equal(streamItems[2].dynamodb.NewImageJSON.id, '3')
    assert.equal(streamItems[3].dynamodb.NewImageJSON.id, '4')
    assert.equal(streamItems[4].dynamodb.NewImageJSON.id, '5')

    assert(streamItems[0].dynamodb.OldImageJSON == null)
    assert(streamItems[1].dynamodb.OldImageJSON == null)
    assert(streamItems[2].dynamodb.OldImageJSON == null)
    assert(streamItems[3].dynamodb.OldImageJSON == null)
    assert(streamItems[4].dynamodb.OldImageJSON == null)

    assert(streamItems[0].dynamodb.NewImage == null)
    assert(streamItems[1].dynamodb.NewImage == null)
    assert(streamItems[2].dynamodb.NewImage == null)
    assert(streamItems[3].dynamodb.NewImage == null)
    assert(streamItems[4].dynamodb.NewImage == null)

    assert(streamItems[0].dynamodb.OldImage == null)
    assert(streamItems[1].dynamodb.OldImage == null)
    assert(streamItems[2].dynamodb.OldImage == null)
    assert(streamItems[3].dynamodb.OldImage == null)
    assert(streamItems[4].dynamodb.OldImage == null)

    myStream.close()
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
      ListStreamsLimit: 1,
      ShardIteratorType: 'TRIM_HORIZON',
      Debug: true,
      ShardUpdatePeriod: 1000,
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
    name: 'sally',
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

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      ListStreamsLimit: 1,
      ShardIteratorType: 'TRIM_HORIZON',
      Debug: true,
      ShardUpdatePeriod: 1000,
    })
    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'stream-exists')
    })

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 10) {
        break
      }
    }
    streamItems.sort((a, b) => (
      Number(a.dynamodb.NewImage.createTime.N)
        - Number(b.dynamodb.NewImage.createTime.N)
    ))

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')

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

    assert(insertItems[0].dynamodb.NewImageJSON == null)
    assert(insertItems[1].dynamodb.NewImageJSON == null)
    assert(insertItems[2].dynamodb.NewImageJSON == null)
    assert(insertItems[3].dynamodb.NewImageJSON == null)
    assert(insertItems[4].dynamodb.NewImageJSON == null)

    assert(insertItems[0].dynamodb.OldImageJSON == null)
    assert(insertItems[1].dynamodb.OldImageJSON == null)
    assert(insertItems[2].dynamodb.OldImageJSON == null)
    assert(insertItems[3].dynamodb.OldImageJSON == null)
    assert(insertItems[4].dynamodb.OldImageJSON == null)

    assert.equal(modifyItems[0].dynamodb.NewImage.id.S, '1')
    assert.equal(modifyItems[1].dynamodb.NewImage.id.S, '2')
    assert.equal(modifyItems[2].dynamodb.NewImage.id.S, '3')
    assert.equal(modifyItems[3].dynamodb.NewImage.id.S, '4')
    assert.equal(modifyItems[4].dynamodb.NewImage.id.S, '5')

    assert.equal(modifyItems[0].dynamodb.NewImage.a.N, 1)
    assert.equal(modifyItems[1].dynamodb.NewImage.a.N, 2)
    assert.equal(modifyItems[2].dynamodb.NewImage.a.N, 3)
    assert.equal(modifyItems[3].dynamodb.NewImage.a.N, 4)
    assert.equal(modifyItems[4].dynamodb.NewImage.a.N, 5)

    assert.equal(modifyItems[0].dynamodb.OldImage.id.S, '1')
    assert.equal(modifyItems[1].dynamodb.OldImage.id.S, '2')
    assert.equal(modifyItems[2].dynamodb.OldImage.id.S, '3')
    assert.equal(modifyItems[3].dynamodb.OldImage.id.S, '4')
    assert.equal(modifyItems[4].dynamodb.OldImage.id.S, '5')

    assert(modifyItems[0].dynamodb.OldImage.a == null)
    assert(modifyItems[1].dynamodb.OldImage.a == null)
    assert(modifyItems[2].dynamodb.OldImage.a == null)
    assert(modifyItems[3].dynamodb.OldImage.a == null)
    assert(modifyItems[4].dynamodb.OldImage.a == null)

    assert(modifyItems[0].dynamodb.NewImageJSON == null)
    assert(modifyItems[1].dynamodb.NewImageJSON == null)
    assert(modifyItems[2].dynamodb.NewImageJSON == null)
    assert(modifyItems[3].dynamodb.NewImageJSON == null)
    assert(modifyItems[4].dynamodb.NewImageJSON == null)

    assert(modifyItems[0].dynamodb.OldImageJSON == null)
    assert(modifyItems[1].dynamodb.OldImageJSON == null)
    assert(modifyItems[2].dynamodb.OldImageJSON == null)
    assert(modifyItems[3].dynamodb.OldImageJSON == null)
    assert(modifyItems[4].dynamodb.OldImageJSON == null)

    myStream.close()
  }

  {
    const myStream = new DynamoDBStream({
      table: tableName,
      ...awsCreds,
      ListStreamsLimit: 1,
      ShardIteratorType: 'TRIM_HORIZON',
      Debug: true,
      ShardUpdatePeriod: 1000,
      JSON: true,
    })
    await myStream.ready.then(({ message }) => {
      assert.equal(message, 'stream-exists')
    })

    const streamItems = []
    for await (const streamItem of myStream) {
      streamItems.push(streamItem)
      if (streamItems.length == 10) {
        break
      }
    }
    streamItems.sort((a, b) => (
      a.dynamodb.NewImageJSON.createTime - b.dynamodb.NewImageJSON.createTime
    ))

    const insertItems = streamItems.filter(item => item.eventName == 'INSERT')
    const modifyItems = streamItems.filter(item => item.eventName == 'MODIFY')

    assert.equal(insertItems[0].dynamodb.NewImageJSON.id, '1')
    assert.equal(insertItems[1].dynamodb.NewImageJSON.id, '2')
    assert.equal(insertItems[2].dynamodb.NewImageJSON.id, '3')
    assert.equal(insertItems[3].dynamodb.NewImageJSON.id, '4')
    assert.equal(insertItems[4].dynamodb.NewImageJSON.id, '5')

    assert(insertItems[0].dynamodb.OldImageJSON == null)
    assert(insertItems[1].dynamodb.OldImageJSON == null)
    assert(insertItems[2].dynamodb.OldImageJSON == null)
    assert(insertItems[3].dynamodb.OldImageJSON == null)
    assert(insertItems[4].dynamodb.OldImageJSON == null)

    assert(insertItems[0].dynamodb.NewImage == null)
    assert(insertItems[1].dynamodb.NewImage == null)
    assert(insertItems[2].dynamodb.NewImage == null)
    assert(insertItems[3].dynamodb.NewImage == null)
    assert(insertItems[4].dynamodb.NewImage == null)

    assert(insertItems[0].dynamodb.OldImage == null)
    assert(insertItems[1].dynamodb.OldImage == null)
    assert(insertItems[2].dynamodb.OldImage == null)
    assert(insertItems[3].dynamodb.OldImage == null)
    assert(insertItems[4].dynamodb.OldImage == null)

    assert.equal(modifyItems[0].dynamodb.NewImageJSON.id, '1')
    assert.equal(modifyItems[1].dynamodb.NewImageJSON.id, '2')
    assert.equal(modifyItems[2].dynamodb.NewImageJSON.id, '3')
    assert.equal(modifyItems[3].dynamodb.NewImageJSON.id, '4')
    assert.equal(modifyItems[4].dynamodb.NewImageJSON.id, '5')

    assert.equal(modifyItems[0].dynamodb.NewImageJSON.a, 1)
    assert.equal(modifyItems[1].dynamodb.NewImageJSON.a, 2)
    assert.equal(modifyItems[2].dynamodb.NewImageJSON.a, 3)
    assert.equal(modifyItems[3].dynamodb.NewImageJSON.a, 4)
    assert.equal(modifyItems[4].dynamodb.NewImageJSON.a, 5)

    assert.equal(modifyItems[0].dynamodb.OldImageJSON.id, '1')
    assert.equal(modifyItems[1].dynamodb.OldImageJSON.id, '2')
    assert.equal(modifyItems[2].dynamodb.OldImageJSON.id, '3')
    assert.equal(modifyItems[3].dynamodb.OldImageJSON.id, '4')
    assert.equal(modifyItems[4].dynamodb.OldImageJSON.id, '5')

    assert(modifyItems[0].dynamodb.OldImageJSON.a == null)
    assert(modifyItems[1].dynamodb.OldImageJSON.a == null)
    assert(modifyItems[2].dynamodb.OldImageJSON.a == null)
    assert(modifyItems[3].dynamodb.OldImageJSON.a == null)
    assert(modifyItems[4].dynamodb.OldImageJSON.a == null)

    assert(modifyItems[0].dynamodb.NewImage == null)
    assert(modifyItems[1].dynamodb.NewImage == null)
    assert(modifyItems[2].dynamodb.NewImage == null)
    assert(modifyItems[3].dynamodb.NewImage == null)
    assert(modifyItems[4].dynamodb.NewImage == null)

    assert(modifyItems[0].dynamodb.OldImage == null)
    assert(modifyItems[1].dynamodb.OldImage == null)
    assert(modifyItems[2].dynamodb.OldImage == null)
    assert(modifyItems[3].dynamodb.OldImage == null)
    assert(modifyItems[4].dynamodb.OldImage == null)

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

  await table.delete()
}).case()

const test = Test.all([
  test1,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
