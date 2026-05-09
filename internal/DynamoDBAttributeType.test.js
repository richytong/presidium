const Test = require('thunk-test')
const DynamoDBAttributeType = require('./DynamoDBAttributeType')

const test = new Test('DynamoDBAttributeType', DynamoDBAttributeType)

test.case('string', 'S')
test.case('S', 'S')
test.case('number', 'N')
test.case('N', 'N')
test.case('binary', 'B')
test.case('B', 'B')
test.throws('test', new TypeError('Invalid value test'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
