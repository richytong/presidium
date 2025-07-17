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
  constructor(message) {
    super()

    if (message.startsWith('<?xml')) {
      const data = XML.parse(message)
      this.name = data.Error.Code
      this.message = data.Error.Message
    } else {
      try {
        const data = JSON.parse(message)
        this.name = data.__type.split('#')[1]
        this.message = data.Message
      } catch (_error) {
        this.name = 'AwsError'
        this.message = message
      }
    }
  }
}

module.exports = AwsError
