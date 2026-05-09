const Test = require('thunk-test')
const assert = require('assert')
const parseURL = require('./parseURL')

const test = new Test('parseURL', parseURL)

test.case('/', url => {
  assert.equal(url.constructor, URL)
})

test.case('http://test.test', url => {
  assert.equal(url.constructor, URL)
})

test.throws('test.test', new TypeError('Invalid URL'))

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
