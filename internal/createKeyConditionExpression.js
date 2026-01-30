const hashJSON = require('./hashJSON')

const trim = value => value.trim()

/**
 * @name createKeyConditionExpression
 *
 * @docs
 * ```coffeescript [specscript]
 * createKeyConditionExpression(options {
 *   keyConditionStatements: Array<string>,
 * }) -> string
 * ```
 */
const createKeyConditionExpression = function (options) {
  const {
    keyConditionStatements,
  } = options

  return keyConditionStatements.map(function (statement) {
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

module.exports = createKeyConditionExpression
