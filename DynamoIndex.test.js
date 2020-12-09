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
    await this.dynamo.deleteTable('test-tablename-2')
  })
  .before(async function () {
    await this.dynamo.createTable('test-tablename', [{ id: 'string' }])
    await this.dynamo.createIndex('test-tablename', [{ status: 'string' }, { createTime: 'number' }])
    await this.dynamo.createTable('test-tablename-2', [{ id: 'string' }])
    await this.dynamo.createIndex('test-tablename-2', [{ status: 'string' }, { name: 'string' }])
  })
  .before(async function () {

    this.testTable = new DynamoTable({
      name: 'test-tablename',
      endpoint: 'http://localhost:8000/',
      // TODO key: [...],
    })
    this.testTable2 = new DynamoTable({
      name: 'test-tablename-2',
      endpoint: 'http://localhost:8000/',
      // TODO key: [...],
    })

    for (const table of [this.testTable, this.testTable2]) {
      await table.putItem({
        id: '1',
        status: 'waitlist',
        createTime: 1000,
        name: 'George',
      })
      await table.putItem({
        id: '2',
        status: 'waitlist',
        createTime: 1001,
        name: 'geo',
      })
      await table.putItem({
        id: '3',
        status: 'waitlist',
        createTime: 1002,
        name: 'john',
      })
      await table.putItem({
        id: '4',
        status: 'approved',
        createTime: 1003,
        name: 'sally',
      })
      await table.putItem({
        id: '5',
        status: 'approved',
        createTime: 1004,
        name: 'sally',
      })
    }

  })
  .case({
    name: 'status-createTime-index',
    table: 'test-tablename',
    key: [{ status: 'string' }, { createTime: 'number' }],
    endpoint: 'http://localhost:8000/',
  }, async index => {
    assert(index.table == 'test-tablename')
    assert(index.name == 'status-createTime-index')

    assert.deepEqual(
      await index.query('status = :status AND createTime > :createTime', {
        status: 'waitlist',
        createTime: 1000,
      }),
      {
        Items: [
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' },
            name: { S: 'john' },
          }
        ],
        Count: 2,
        ScannedCount: 2
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime BETWEEN :lower AND :upper', {
        status: 'waitlist',
        lower: 999,
        upper: 2000,
      }),
      {
        Items: [
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' },
            name: { S: 'George' },
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' },
            name: { S: 'john' },
          }
        ],
        Count: 3,
        ScannedCount: 3
      })


    assert.deepEqual(
      await index.query('status = :status AND createTime >= :createTime', {
        status: 'waitlist',
        createTime: 1000,
      }, { scanIndexForward: true }),
      {
        Items: [
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' },
            name: { S: 'George' },
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' },
            name: { S: 'john' },
          }
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime >= :createTime', {
        status: 'waitlist',
        createTime: 1000,
      }, { scanIndexForward: false }),
      {
        Items: [
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' },
            name: { S: 'john' },
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' },
            name: { S: 'George' },
          },
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime >= :createTime', {
        status: 'waitlist',
        createTime: 1000,
      }, {
        scanIndexForward: false,
        projectionExpression: 'name,status',
      }),
      {
        Items: [
          {
            status: { S: 'waitlist' },
            name: { S: 'john' },
          },
          {
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
          {
            status: { S: 'waitlist' },
            name: { S: 'George' },
          },
        ],
        Count: 3,
        ScannedCount: 3
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime <= :createTime', {
        status: 'waitlist',
        createTime: 10e3,
      }, {
        scanIndexForward: false,
        limit: 2,
      }),
      {
        Items: [
          {
            createTime: { N: '1002' },
            id: { S: '3' },
            status: { S: 'waitlist' },
            name: { S: 'john' },
          },
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
        ],
        LastEvaluatedKey: {
          createTime: { N: '1001' },
          id: { S: '2' },
          status: { S: 'waitlist' },
        },
        Count: 2,
        ScannedCount: 2,
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime <= :createTime', {
        status: 'waitlist',
        createTime: 10e3,
      }, {
        scanIndexForward: false,
        limit: 2,
        exclusiveStartKey: {
          createTime: { N: '1001' },
          id: { S: '2' },
          status: { S: 'waitlist' },
        },
      }),
      {
        Items: [
          {
            createTime: { N: '1000' },
            id: { S: '1' },
            status: { S: 'waitlist' },
            name: { S: 'George' },
          },
        ],
        Count: 1,
        ScannedCount: 1,
      })

    assert.deepEqual(
      await index.query('status = :status', { status: 'approved' }),
      {
        Items: [
          {
            createTime: { N: '1003' },
            id: { S: '4' },
            status: { S: 'approved' },
            name: { S: 'sally' },
          },
          {
            createTime: { N: '1004' },
            id: { S: '5' },
            status: { S: 'approved' },
            name: { S: 'sally' },
          },
        ],
        Count: 2,
        ScannedCount: 2
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime = :createTime', {
        status: 'approved',
        createTime: 1004,
      }),
      {
        Items: [
          {
            createTime: { N: '1004' },
            id: { S: '5' },
            status: { S: 'approved' },
            name: { S: 'sally' },
          },
        ],
        Count: 1,
        ScannedCount: 1
      })

    assert.deepEqual(
      await index.query('status = :status AND createTime < :createTime', {
        status: 'approved',
        createTime: 10,
      }),
      {
        Items: [],
        Count: 0,
        ScannedCount: 0
      })
  })
  .case({
    name: 'status-name-index',
    table: 'test-tablename-2',
    key: [{ status: 'string' }, { name: 'string' }],
    endpoint: 'http://localhost:8000/',
  }, async index => {
    assert(index.table == 'test-tablename-2')
    assert(index.name == 'status-name-index')
    assert.deepEqual(
      await index.query('status = :status AND begins_with(name, :name)', {
        status: 'waitlist',
        name: 'geo',
      }),
      {
        Items: [
          {
            createTime: { N: '1001' },
            id: { S: '2' },
            status: { S: 'waitlist' },
            name: { S: 'geo' },
          },
        ],
        Count: 1,
        ScannedCount: 1
      })

    assert.deepEqual(
      await index.query('status = :st AND begins_with ( name, :prefix ) ', {
        st: 'approved',
        prefix: 's',
      }),
      {
        Items: [
          {
            name: { S: 'sally' },
            id: { S: '4' },
            createTime: { N: '1003' },
            status: { S: 'approved' }
          },
          {
            name: { S: 'sally' },
            id: { S: '5' },
            createTime: { N: '1004' },
            status: { S: 'approved' }
          }
        ],
        Count: 2,
        ScannedCount: 2
      })

  })
  .after(async function () {
    await this.dynamo.deleteTable('test-tablename')
    await this.dynamo.deleteTable('test-tablename-2')
  })
