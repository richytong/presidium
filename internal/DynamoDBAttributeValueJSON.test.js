const Test = require('thunk-test')
const DynamoDBAttributeValueJSON = require('./DynamoDBAttributeValueJSON')

const test = new Test('DynamoDBAttributeValueJSON', DynamoDBAttributeValueJSON)

test.case({ S: 'test' }, 'test')
test.case({ N: '3' }, 3)
test.case({ BOOL: true }, true)
test.case({ BOOL: false }, false)
test.case({ NULL: true }, null)
test.case({ L: [{ N: '1' }, { N: '2' }, { N: '3' }] }, [1, 2, 3])
test.case({ M: { a: { N: '1' }, b: { N: '2' }, c: { N: '3' } } }, { a: 1, b: 2, c: 3 })
test.throws({}, new TypeError('Invalid AttributeValue undefined'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
