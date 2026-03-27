const Test = require('./thunk-test')
const RetryAwsErrors = require('./RetryAwsErrors')

// TODO
const throwThrottlingException = () => {
  const error = new Error('Rate exceeded')
  error.name = 'ThrottlingException'
  throw error
}

const test = new Test('RetryAwsErrors', RetryAwsErrors)

test.case(throwThrottlingException)

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
