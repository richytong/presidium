const assert = require('assert')
const Dynamo = require('./Dynamo')
const DynamoTable = require('./DynamoTableV2')
const teardown = require('./teardown')
const AwsCredentials = require('./AwsCredentials')

describe('DynamoTableV2', () => {
  it('init', async () => {
    const table = new DynamoTable({
      name: 'test-table',
      endpoint: 'http://localhost:8000/',
      key: [{ id: 'string' }],
    })
    await table.ready

    await table.destroy()
  }).timeout(60000)

  it.skip('production init', async () => {
    const awsCreds = await AwsCredentials('solum')
    const region = 'us-east-1'
    awsCreds.region = region
    const table = new DynamoTable({
      name: 'test-table',
      key: [{ id: 'string' }],
      ...awsCreds,
    })
    await table.ready

    await table.destroy()
  }).timeout(60000)

  it('putItem, getItem, updateItem, incrementItem, deleteItem', async () => {
    const table = new DynamoTable({
      name: 'test-table',
      endpoint: 'http://localhost:8000/',
      key: [{ id: 'string' }],
    })
    await table.ready

    await table.putItem({ id: 'a', name: 'b' })

    const res = await table.getItem({ id: 'a' })
    assert.equal(typeof res.Item, 'object')

    const item = map(res.Item, Dynamo.attributeValueToJSON)
    assert.equal(item.id, 'a')
    assert.equal(item.name, 'b')

    const res0 = await table.updateItem(
      { id: 'a' },
      { attr: 2 },
      { ReturnValues: 'ALL_NEW' }
    )
    assert.equal(typeof res0.Attributes, 'object')

    const item0 = map(res0.Attributes, Dynamo.attributeValueToJSON)
    assert.equal(item0.id, 'a')
    assert.equal(item0.name, 'b')
    assert.equal(item0.attr, 2)

    await table.incrementItem({ id: 'a' }, { attr: 1 })
    await table.getItem({ id: 'a' }).then(pipe([
      get('Item'),
      map(Dynamo.attributeValueToJSON),
      item => {
        assert.equal(item.attr, 3)
      },
    ]))

    await table.deleteItem({ id: 'a' })
    await assert.rejects(
      table.getItem({ id: 'a' }),
      { message: 'Item not found for {"id":"a"}' },
    )
  })

  it('scan, query', async () => {
    const table = new DynamoTable({
      name: 'test-table',
      endpoint: 'http://localhost:8000/',
      key: [{ id: 'string' }],
    })
    await table.ready

    await table.putItem({ id: '1' })
    await table.putItem({ id: '2' })
    await table.putItem({ id: '3' })

    const res0 = await table.scan({ limit: 1000 })
    assert.equal(res0.Count, 3)
    assert.equal(res0.ScannedCount, 3)
    assert.equal(res0.Items.length, 3)

    const res1 = await table.query('id = :id', { id: '3' }, {
      Limit: 1000,
      ScanIndexForward: true,
      Select: 'ALL_ATTRIBUTES',
      ConsistentRead: true,
    })
    assert.equal(res1.Count, 1)
    assert.equal(res1.ScannedCount, 1)
    assert.equal(res1.Items.length, 1)

    const items1 = map(res1.Items, map(Dynamo.attributeValueToJSON))
    assert.equal(items1[0].id, '3')

    const res2 = await table.query('id = :id', { id: '3' }, {
      limit: 1000,
      scanIndexForward: true,
      select: 'ALL_ATTRIBUTES',
      consistentRead: true,
    })
    assert.equal(res2.Count, 1)
    assert.equal(res2.ScannedCount, 1)
    assert.equal(res2.Items.length, 1)

    const items2 = map(res2.Items, map(Dynamo.attributeValueToJSON))
    assert.equal(items2[0].id, '3')
  }).timeout(60000)
})
