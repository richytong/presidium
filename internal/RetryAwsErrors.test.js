const Test = require('thunk-test')
const assert = require('assert')
const RetryAwsErrors = require('./RetryAwsErrors')

const test = new Test('RetryAwsErrors', async function integration() {

  let didThrow1 = false
  const throw1ThrottlingException = async () => {
    if (didThrow1) {
      return true
    }
    didThrow1 = true
    const error = new Error('Rate exceeded')
    error.name = 'ThrottlingException'
    throw error
  }

  const retryThrow1ThrottlingException = RetryAwsErrors(throw1ThrottlingException, {})

  assert.strictEqual(await retryThrow1ThrottlingException(), true)

  const throwError = async () => {
    const error = new Error('test')
    throw error
  }

  const retryThrowError = RetryAwsErrors(throwError, {})

  assert.rejects(
    retryThrowError(),
    new Error('test')
  )

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
