const Test = require('thunk-test')
const createKeyConditionExpression = require('./createKeyConditionExpression')
const hashJSON = require('./hashJSON')

const test = new Test('createKeyConditionExpression', createKeyConditionExpression)

test.case({ keyConditionStatements: ['begins_with(test, :a)'] }, `begins_with(#${hashJSON('test')}, :a)`)
test.case({ keyConditionStatements: ['a > :a', 'b = :b', 'c <= :c'] }, `#${hashJSON('a')} > :a AND #${hashJSON('b')} = :b AND #${hashJSON('c')} <= :c`)

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
