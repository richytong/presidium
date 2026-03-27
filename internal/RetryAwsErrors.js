const sleep = require('./sleep')

/**
 * @name RetryAwsErrors
 *
 * @docs
 * ```coffeescript [specscript]
 * RetryAwsErrors(func function, context object) -> retriesAwsErrors function
 * ```
 */

const RetryAwsErrors = function (func, context, name) {
  return function retriesAwsErrors(...args) {
    return func.apply(context, args).catch(error => {
      if (error.retryable) {
        console.error(error)
        await sleep(1000)
        return retriesAwsErrors(...args)
      }
      throw error
    })
  }
}

module.exports = RetryAwsErrors
