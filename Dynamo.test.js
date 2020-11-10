const Test = require('thunk-test')
const Dynamo = require('./Dynamo')

module.exports = [
  Test('Dynamo.toAttributeValue', Dynamo.toAttributeValue)
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
    .throws(NaN, new TypeError('unknown value NaN')),

  Test('Dynamo.fromAttributeValue', Dynamo.fromAttributeValue)
    .case({ S: 'hey' }, 'hey')
    .case({ S: '' }, '')
    .case({ N: '1' }, 1)
    .case({ N: '1.015' }, 1.015)
    .case({ N: '0' }, 0)
    .case({ N: '-1' }, -1)
    .case({ BOOL: true }, true)
    .case({ NULL: true }, null)
    .case({ NULL: true }, null)
    .case({ M: { a: { N: '1' }, b: { L: [{ S: 'a' }, { BOOL: true }] } } }, { a: 1, b: ['a', true] })
    .throws(NaN, new TypeError('unknown value NaN')),
]

