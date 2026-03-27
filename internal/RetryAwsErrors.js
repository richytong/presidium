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
    return func.apply(context, args).catch(async error => {
      if (
        error.name == 'ThrottlingException'
        || error.name == 'RateExceeded'
        || error.name == 'TooManyRequestsException'
        || error.code == 408
        || error.code == 429
        || error.code == 500
        || error.code == 502
        || error.code == 503
        || error.code == 504
        || error.code == 509
      ) {
        await sleep(1000)
        return retriesAwsErrors(...args)
      }
      throw error
    })
  }
}

module.exports = RetryAwsErrors
