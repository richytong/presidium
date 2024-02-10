const assert = require('assert')
const https = require('https')
const Test = require('thunk-test')
const HttpsAgent = require('./HttpsAgent')

const test = new Test('HttpsAgent', HttpsAgent)
.case(agent => {
  assert(agent.constructor == https.Agent)
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
