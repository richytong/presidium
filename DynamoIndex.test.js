const assert = require('assert')
const map = require('rubico/map')
const Test = require('thunk-test')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTable')
const DynamoIndex = require('./DynamoIndex')
const inspect = require('./internal/inspect')

module.exports = Test('DynamoIndex', DynamoIndex)
  .before(async function () {
    this.dynamo = Dynamo('http://localhost:8000/')
    await this.dynamo.deleteTable('test-tablename')
  })
  .before(async function () {
    await this.dynamo.createTable('test-tablename', [{ id: 'string' }])
    await this.dynamo.createIndex('test-tablename', [{ status: 'string' }, { createTime: 'number' }])
  })
  .before(async function () {

    this.testTable = DynamoTable('http://localhost:8000/', 'test-tablename')
    await this.testTable.putItem({
      id: '1',
      status: 'waitlist',
      createTime: 1000,
    })
    await this.testTable.putItem({
      id: '2',
      status: 'waitlist',
      createTime: 1001,
    })

    await this.testTable.putItem({
      id: '3',
      status: 'waitlist',
      createTime: 1002,
    })
    await this.testTable.putItem({
      id: '4',
      status: 'approved',
      createTime: 1003,
    })
    await this.testTable.putItem({
      id: '5',
      status: 'approved',
      createTime: 1004,
    })

  })
  .case('http://localhost:8000/', 'test-tablename', 'status-createTime-index', async statusCreateTimeIndex => {
    assert(statusCreateTimeIndex.tablename == 'test-tablename')
    assert(statusCreateTimeIndex.indexname == 'status-createTime-index')

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
        ])
      }),
      {
        Items: [
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          }
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
          $.gt('createTime', 1000),
        ])
      }),
      {
        Items: [
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          }
        ],
        Count: 2,
        ScannedCount: 2
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
          $.gte('createTime', 1000),
        ])
        $.sortBy('createTime', 1)
      }),
      {
        Items: [
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          }
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
          $.gte('createTime', 1000),
        ])
        $.sortBy('createTime', -1)
      }),
      {
        Items: [
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' }
          },
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
          $.gte('createTime', 1000),
        ])
        $.order(-1)
      }),
      {
        Items: [
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' }
          },
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'waitlist'),
          $.lte('createTime', 10000),
        ])
        $.order(-1)
        $.limit(2)
      }),
      {
        Items: [
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' }
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' }
          },
        ],
        LastEvaluatedKey: {
          createTime: { N: '1001' },
          id: { S: '2' },
          status: { S: 'waitlist' }
        },
        Count: 2,
        ScannedCount: 2,
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'approved'),
        ])
      }),
      {
        Items: [
          {
            createTime: { N: '1003' },
            id: { S: '4' },
            status: { S: 'approved' }
          },
          {
            createTime: { N: '1004' },
            id: { S: '5' },
            status: { S: 'approved' }
          },
        ],
        Count: 2,
        ScannedCount: 2
      })

    assert.deepEqual(
      await statusCreateTimeIndex.query($ => {
        $.and([
          $.eq('status', 'approved'),
          $.eq('createTime', 1004),
        ])
      }),
      {
        Items: [
          {
            createTime: { N: '1004' },
            id: { S: '5' },
            status: { S: 'approved' }
          },
        ],
        Count: 1,
        ScannedCount: 1
      })
  })
  .after(async function () {
    await this.dynamo.deleteTable('test-tablename')
  })
