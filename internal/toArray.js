const isArray = require('./isArray')

/**
 * @name toArray
 *
 * @docs
 * ```coffeescript [specscript]
 * toArray(value Array|any) -> originalValueOrArrayOfJustValue Array
 * ```
 */
const toArray = value => isArray(value) ? value : [value]

module.exports = toArray
