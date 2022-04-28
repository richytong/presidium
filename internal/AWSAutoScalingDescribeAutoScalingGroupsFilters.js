const rubico = require('rubico')
const filterExists = require('./filterExists')
const objectFilterKeys = require('./objectFilterKeys')
const toArray = require('./toArray')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, set, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

/**
 * @name AWSAutoScalingDescribeAutoScalingGroupsFilters
 *
 * @synopsis
 * ```coffeescript [specscript]
 * import AutoScalingListGroupsDescribeFilterOptions
 *   from './AutoScalingListGroupsDescribeFilterOptions.ss'
 *
 * AWSAutoScalingDescribeAutoScalingGroupsFilters(
 *   options AutoScalingListGroupsDescribeFilterOptions
 * ) -> awsAutoScalingDescribeAutoScalingGroupsFilters Array<{ Name: string, Values: Array }>
 * ```
 */
const AWSAutoScalingDescribeAutoScalingGroupsFilters = pipe([
  options => ({
    'tag-key': options.tagKey,
    'tag-value': options.tagValue,
    ...objectFilterKeys(options, key => key.startsWith('tag:')),
  }),
  filterExists,
  options => {
    const filters = []
    for (const name in options) {
      filters.push({ Name: name, Values: toArray(options[name]) })
    }
    return filters
  },
])

module.exports = AWSAutoScalingDescribeAutoScalingGroupsFilters
