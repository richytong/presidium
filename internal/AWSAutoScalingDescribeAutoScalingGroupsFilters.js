require('rubico/global')
const filterExists = require('./filterExists')
const objectFilterKeys = require('./objectFilterKeys')
const toArray = require('./toArray')

/**
 * @name AWSAutoScalingDescribeAutoScalingGroupsFilters
 *
 * @docs
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
