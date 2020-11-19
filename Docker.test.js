const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')

module.exports = Test('Docker', Docker)
  .case(docker => {
    assert.equal(docker.constructor, Docker)
    assert.equal(new Docker().constructor, Docker)
  })
