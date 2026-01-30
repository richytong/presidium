const assert = require('assert')
const Test = require('thunk-test')
const Dynamo = require('./Dynamo')

const combinedTest = Test.all([
  Test('Dynamo.AttributeValue', Dynamo.AttributeValue)
    .case('hey', { S: 'hey' })
    .case('', { S: '' })
    .case(1, { N: '1' })
    .case(1.015, { N: '1.015' })
    .case(0, { N: '0' })
    .case(-1, { N: '-1' })
    .case(true, { BOOL: true })
    .case(null, { NULL: true })
    .case(undefined, { NULL: true })
    .case({ a: 1, b: ['a', true] }, { M: { a: { N: '1' }, b: { L: [{ S: 'a' }, { BOOL: true }] } } })
    .throws(NaN, new TypeError('Invalid value NaN')),

  Test('Dynamo.attributeValueToJSON', Dynamo.attributeValueToJSON)
    .case({ S: 'hey' }, 'hey')
    .case({ S: '' }, '')
    .case({ N: '1' }, 1)
    .case({ N: '1.015' }, 1.015)
    .case({ N: '0' }, 0)
    .case({ N: '-1' }, -1)
    .case({ BOOL: true }, true)
    .case({ NULL: true }, null)
    .case({ NULL: false }, null)
    .case({ M: { a: { N: '1' }, b: { L: [{ S: 'a' }, { BOOL: true }] } } }, { a: 1, b: ['a', true] })
    .throws(NaN, new TypeError('Invalid attributeValue NaN')),

  Test('Dynamo.AttributeType', Dynamo.AttributeType)
    .case('string', 'S')
    .case('S', 'S')
    .case('number', 'N')
    .case('N', 'N')
    .case('binary', 'B')
    .case('B', 'B')
    .throws('?', new TypeError('Invalid value ?')),

  Test('Dynamo.isDynamoDBJSON', Dynamo.isDynamoDBJSON)
    .case('a', false)
    .case({ S: 'a' }, false)
    .case({ a: { S: '1' } }, true)
    .case({ a: { S: '1' }, b: 2 }, false),

  Test('Dynamo.isAttributeValue', Dynamo.isAttributeValue)
    .case(1, false)
    .case({ S: '1' }, true)
    .case({ N: '1' }, true)
    .case({ B: Buffer.from([1, 2, 3]) }, true)
    .case({ BOOL: 'true' }, true)
    .case({ NULL: true }, true)
    .case({ M: {} }, true),

  Test('Dynamo', (...args) => new Dynamo(...args))
    .case({ endpoint: 'http://localhost:8000' }, async function (dynamo) {
      await dynamo.deleteTable('test-1').catch(() => {})
      await dynamo.waitFor('test-1', 'tableNotExists')
      await dynamo.deleteTable('test-2').catch(() => {})
      await dynamo.waitFor('test-2', 'tableNotExists')
      {
        const response = await dynamo.createTable('test-1', [{ a: 'string' }, { b: 'number' }])
        assert.strictEqual(response.TableDescription.TableName, 'test-1')
      }
      {
        const response = await dynamo.createTable('test-2', [{ a: 'string' }, { b: 'number' }], {
          BillingMode: 'PAY_PER_REQUEST',
        })
        assert.strictEqual(response.TableDescription.TableName, 'test-2')
        assert.strictEqual(response.TableDescription.BillingModeSummary.BillingMode, 'PAY_PER_REQUEST')
      }
      await dynamo.deleteTable('test-1').catch(() => {})
      await dynamo.waitFor('test-1', 'tableNotExists')
      await dynamo.deleteTable('test-2').catch(() => {})
      await dynamo.waitFor('test-2', 'tableNotExists')
    })
    .case({
      endpoint: 'http://localhost:8000',
    }, async function (dynamo) {
      assert.strictEqual(dynamo.client.config.endpoint, 'http://localhost:8000')
    }),
])

if (process.argv[1] == __filename) {
  combinedTest()
}

module.exports = combinedTest
