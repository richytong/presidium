const hashJSON = require('./hashJSON')

const trim = value => value.trim()

/**
 * @name createFilterExpression
 *
 * @docs
 * ```coffeescript [specscript]
 * createFilterExpression(options {
 *   filterExpressionStatements: Array<string>,
 * }) -> string
 * ```
 */
const createFilterExpression = function (options) {
  const {
    filterExpressionStatements,
  } = options

  return filterExpressionStatements.map(function (statement) {
    if (statement.startsWith('begins_with')) {
      const [field, prefix] = statement // 'begins_with(name, :prefix)'
        .split(/[()]/)[1] // 'name, :prefix'
        .split(',').map(trim) // ['name', ':prefix']
      return `begins_with(#${hashJSON(field)}, ${prefix})`
    }
    const [field, rest] = statement.split(/ (.+)/)
    return `#${hashJSON(field)} ${rest}`
  }).join(' AND ')
}

module.exports = createFilterExpression
