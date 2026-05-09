const Test = require('thunk-test')
const createFilterExpression = require('./createFilterExpression')
const hashJSON = require('./hashJSON')

const test = new Test('createFilterExpression', createFilterExpression)

test.case({ filterExpressionStatements: ['begins_with(test, :a)'] }, `begins_with(#${hashJSON('test')}, :a)`)
test.case({ filterExpressionStatements: ['a > :a', 'b = :b', 'c <= :c'] }, `#${hashJSON('a')} > :a AND #${hashJSON('b')} = :b AND #${hashJSON('c')} <= :c`)

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
