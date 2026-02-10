const assert = require('assert')
const Test = require('thunk-test')
const httpConfigure = require('./httpConfigure')

const test1 = new Test('httpConfigure', httpConfigure)
test1.case('http://localhost:7357', function baseUrlString() {
  assert.equal(this.baseUrl.constructor, URL)
})

const test2 = new Test('httpConfigure', httpConfigure)
test2.case({ toString: () => 'http://localhost:7357' }, function baseUrlToString() {
  assert.equal(this.baseUrl.constructor, URL)
})

const test3 = new Test('httpConfigure', httpConfigure)
test3.throws(undefined, new TypeError('Invalid baseUrl'))
test3.throws(1, new TypeError('Invalid URL'))

const test4 = new Test('httpConfigure', httpConfigure)
test4.case('http://username:password@localhost:7357', function baseUrlStringWithUsernamePassword() {
  assert.equal(this.baseUrl.constructor, URL)
  assert.equal(this.baseUrl.username, 'username')
  assert.equal(this.baseUrl.password, 'password')
})

const test5 = new Test('httpConfigure', httpConfigure)
test5.case('https://localhost:7357', function baseUrlString() {
  assert.equal(this.baseUrl.constructor, URL)
  assert.equal(this.baseUrl.protocol, 'https:')
})

const test = Test.all([
  test1,
  test2,
  test3,
  test4,
  test5,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
