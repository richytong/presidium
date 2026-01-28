const Test = require('thunk-test')
const handleDynamoDBStreamGetRecordsError =
  require('./handleDynamoDBStreamGetRecordsError')

const test = new Test('handleDynamoDBStreamGetRecordsError', handleDynamoDBStreamGetRecordsError)

test.case(new Error('Shard iterator has expired'), [])
test.throws(new Error('other'), new Error('other'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
