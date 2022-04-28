/**
 * @name toArray
 *
 * @synopsis
 * ```coffeescript [specscript]
 * toArray(value Array|any) -> originalValueOrArrayOfJustValue Array
 * ```
 */
const toArray = value => Array.isArray(value) ? value : [value]

module.exports = toArray
