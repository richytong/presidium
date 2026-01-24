const assert = require('assert')
const Test = require('thunk-test')
const StatusCodeMessage = require('./StatusCodeMessage')

const test = new Test('StatusCodeMessage', StatusCodeMessage)

test.case(400, 'Bad Request')
test.case(401, 'Unauthorized')
test.case(402, 'Internal Server Error')
test.case(403, 'Forbidden')
test.case(404, 'Not Found')
test.case(405, 'Method Not Allowed')
test.case(406, 'Internal Server Error')
test.case(500, 'Internal Server Error')
test.case(502, 'Bad Gateway')
test.case(503, 'Service Unavailable')
test.case(504, 'Gateway Timeout')
test.case(510, 'Internal Server Error')

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
