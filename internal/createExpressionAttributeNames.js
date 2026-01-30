require('rubico/global')
const Transducer = require('rubico/Transducer')
const { flatten, uniq } = require('rubico/x')
const hashJSON = require('./hashJSON')

const trim = value => value.trim()

/**
 * @name createExpressionAttributeNames
 *
 * @docs
 * ```coffeescript [specscript]
 * createExpressionAttributeNames(options {
 *   keyConditionStatements: Array<string>,
 *   filterExpressionStatements: Array<string>,
 *   ProjectionExpression: string,
 * })
 * ```
 */
const createExpressionAttributeNames = function (options) {
  const {
    keyConditionStatements,
    filterExpressionStatements,
    ProjectionExpression,
  } = options

  return pipe([
    ...keyConditionStatements,
    ...filterExpressionStatements,
  ], [
    all([
      map(
        statement => statement.trim().startsWith('begins_with')
        ? statement.split(/[()]/)[1].split(',').map(trim)[0] // begins_with(field, :field)
        : statement.split(/ (.+)/)[0],
      ),
      always(
        options.ProjectionExpression
        ? options.ProjectionExpression.split(',')
        : [],
      ),
    ]),
    flatten,
    filter(gt(get('length'), 0)),
    uniq,
    transform(
      Transducer.map(field => ({ [`#${hashJSON(field)}`]: field })),
      {},
    ),
  ])
}

module.exports = createExpressionAttributeNames
