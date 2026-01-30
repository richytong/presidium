const { Readable } = require('stream')

/**
 * @name StringStream
 *
 * @docs
 * ```coffeescript [specscript]
 * StringStream(str string)
 * ```
 */
const StringStream = function (str) {
  return Readable.from([str])
}

module.exports = StringStream
