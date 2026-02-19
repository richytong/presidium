const path = require('path')

/**
 * @name parsePath
 *
 * @docs
 * ```coffeescript [specscript]
 * parsePath(string) -> Path {
 *   root: string,
 *   dir: string,
 *   base: string,
 *   ext: string,
 *   name: string,
 * }
 * ```
 */
const parsePath = path.parse

module.exports = parsePath
