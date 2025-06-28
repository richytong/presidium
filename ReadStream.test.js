const Test = require('thunk-test')
const assert = require('assert')
const stream = require('stream')
const ReadStream = require('./ReadStream')

const test1 =
  new Test(ReadStream.Buffer)
    .case(stream.Readable.from([Buffer.from('abc')]), Buffer.from('abc'))

const test2 =
  new Test(ReadStream.Text)
    .case(stream.Readable.from(['abc']), 'abc')

const test3 =
  new Test(ReadStream.JSON)
    .case(stream.Readable.from([JSON.stringify({ a: 1 })]), { a: 1 })
    .throws(stream.Readable.from(['s']), new SyntaxError('Unexpected token \'s\', "s" is not valid JSON'))

const test = Test.all([
  test1,
  test2,
  test3,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
