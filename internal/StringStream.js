const { Readable } = require('stream')

/**
 * @name StringStream
 *
 * @synopsis
 * ```coffeescript [specscript]
 * StringStream(str string)
 * ```
 */
const StringStream = function (str) {
  return Readable.from([str])
}

module.exports = StringStream
