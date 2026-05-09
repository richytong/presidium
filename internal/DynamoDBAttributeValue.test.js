const Test = require('thunk-test')
const DynamoDBAttributeValue = require('./DynamoDBAttributeValue')

const test = new Test('DynamoDBAttributeValue', DynamoDBAttributeValue)

test.case('test', { S: 'test' })
test.case(3, { N: '3' })
test.case(true, { BOOL: true })
test.case(false, { BOOL: false })
test.case(null, { NULL: true })
test.case([1, 2, 3], { L: [{ N: '1' }, { N: '2' }, { N: '3' }] })
test.case({ a: 1, b: 2, c: 3 }, { M: { a: { N: '1' }, b: { N: '2' }, c: { N: '3' } } })
test.throws(NaN, new TypeError('Invalid value NaN'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
