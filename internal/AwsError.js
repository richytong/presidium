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
      const ast = XML.parse(message)
      this.name = ast.$children.find(child => child.$name == 'Code')?.$children[0] ?? 'AwsError'
      this.message = ast.$children.find(child => child.$name == 'Message')?.$children[0] ?? ''
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
