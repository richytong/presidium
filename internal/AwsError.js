const StatusCodeMessage = require('./StatusCodeMessage')
const XML = require('../XML')

/**
 * @name AwsError
 *
 * @docs
 * ```coffeescript [specscript]
 * new AwsError(message string)
 * ```
 */
class AwsError extends Error {
  constructor(message, code = 500, data = {}) {
    super()

    if (message.startsWith('<?xml')) {
      const data = XML.parse(message)
      this.name = data.Error.Code
      this.message = data.Error.Message
      this.code = code
    } else if (message == '') {
      this.name = 'AwsError'
      this.message = StatusCodeMessage(code)
      this.code = code
    } else {
      try {
        const data = JSON.parse(message)
        this.name = data.__type.split('#')[1] ?? data.__type
        this.message = data.Message ?? data.message
        this.code = code
      } catch (_error) {
        this.name = 'AwsError'
        this.message = message
        this.code = code
      }
    }

    for (const key in data) {
      this[key] = data[key]
    }
  }
}

module.exports = AwsError
