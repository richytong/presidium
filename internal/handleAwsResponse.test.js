const Test = require('thunk-test')
const handleAwsResponse = require('./handleAwsResponse')
const stream = require('stream')

const test = new Test('handleAwsResponse', handleAwsResponse)

const response1 = stream.Readable.from([JSON.stringify({ A: 1 })])
response1.ok = true

test.case(response1, { A: 1 })

const response2 = stream.Readable.from([JSON.stringify({
  __type: 'Forbidden',
  Message: 'A',
})])
response2.ok = false

test.throws(response2, { name: 'Forbidden', message: 'A' })

const response3 = stream.Readable.from([JSON.stringify({
  __type: 'ThrottlingException',
  Message: 'A',
})])
response3.ok = false

function identity(value) { return value }

test.case(response3, identity, 1, 1)

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
