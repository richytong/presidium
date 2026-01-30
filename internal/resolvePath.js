const nodePath = require('path')

/**
 * @name resolvePath
 *
 * @docs
 * ```coffeescript [specscript]
 * resolvePath(...string) -> resolvedPath string
 * ```
 */
const resolvePath = nodePath.resolve

module.exports = resolvePath
