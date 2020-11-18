const nodePath = require('path')

/**
 * @name pathResolve
 *
 * @synopsis
 * ```coffeescript [specscript]
 * pathResolve(...string) -> resolvedPath string
 * ```
 */
const pathResolve = nodePath.resolve

module.exports = pathResolve
