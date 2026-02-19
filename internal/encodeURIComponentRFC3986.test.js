const Test = require('thunk-test')
const encodeURIComponentRFC3986 = require('./encodeURIComponentRFC3986')

const test = new Test('encodeURIComponentRFC3986', encodeURIComponentRFC3986)

.case('aaa', 'aaa')
.case('', '')
.case(':', '%3A')
.case('/', '%2F')
.case('?', '%3F')
.case('#', '%23')
.case('[', '%5B')
.case(']', '%5D')
.case('@', '%40')
.case('!', '%21')
.case('$', '%24')
.case('&', '%26')
.case('\'', '%27')
.case('(', '%28')
.case(')', '%29')
.case('*', '%2A')
.case('+', '%2B')
.case(',', '%2C')
.case(';', '%3B')
.case('=', '%3D')
.case('%', '%25')
.case(' ', '%20')
.case(undefined, 'undefined')
.case(null, 'null')

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
