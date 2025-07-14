/**
 * @name AwsError
 *
 * @docs
 * ```coffeescript [specscript]
 * new AwsError(text string)
 * ```
 */
class AwsError extends Error {
  constructor(text) {
    super()
    try {
      const data = JSON.parse(text)
      this.name = data.__type.split('#')[1]
      this.message = data.Message
    } catch (_error) {
      this.message = text
    }
  }
}

module.exports = AwsError
