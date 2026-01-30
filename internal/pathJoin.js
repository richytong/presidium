const nodePath = require('path')

/**
 * @name pathJoin
 *
 * @docs
 * ```coffeescript [specscript]
 * pathJoin(parts ...string) -> string
 * ```
 */
const pathJoin = nodePath.join

module.exports = pathJoin
