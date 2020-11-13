const assert = require('assert')
const http = require('http')
const Test = require('thunk-test')
const HttpAgent = require('./HttpAgent')

module.exports = Test('HttpAgent', HttpAgent)
  .case(httpAgent => {
    assert(httpAgent.constructor == http.Agent)
  })
