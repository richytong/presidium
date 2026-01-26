const nodePath = require('path')

/**
 * @name resolvePath
 *
 * @synopsis
 * ```coffeescript [specscript]
 * resolvePath(...string) -> resolvedPath string
 * ```
 */
const resolvePath = nodePath.resolve

module.exports = resolvePath
