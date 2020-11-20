const nodePath = require('path')

/**
 * @name pathJoin
 *
 * @synopsis
 * ```coffeescript [specscript]
 * pathJoin(parts ...string) -> string
 * ```
 */
const pathJoin = nodePath.join

module.exports = pathJoin
