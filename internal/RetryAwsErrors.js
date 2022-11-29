/**
 * @name RetryAwsErrors
 *
 * @synopsis
 * ```coffeescript [specscript]
 * RetryAwsErrors(func function, context object) -> retriesAwsErrors function
 * ```
 */

const RetryAwsErrors = function (func, context, name) {
  return function retriesAwsErrors(...args) {
    return func.apply(context, args).promise().catch(error => {
      if (error.retryable) {
        return retriesAwsErrors(...args)
      }
      throw error
    })
  }
}

module.exports = RetryAwsErrors
