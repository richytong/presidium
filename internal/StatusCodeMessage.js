/**
 * @name StatusCodeMessage
 *
 * @docs
 * ```coffeescript [specscript]
 * StatusCodeMessage(statusCode number) -> message string
 * ```
 */
function StatusCodeMessage(statusCode) {
  switch (statusCode) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 405:
      return 'Method Not Allowed'
    case 500:
      return 'Internal Server Error'
    case 502:
      return 'Bad Gateway'
    case 503:
      return 'Service Unavailable'
    case 504:
      return 'Gateway Timeout'
    default:
      return 'Internal Server Error'
  }
}

module.exports = StatusCodeMessage
