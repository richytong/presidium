const rubico = require('rubico')
const AWSEC2 = require('aws-sdk/clients/ec2')
const AWSDescribeInstancesFilters = require('./internal/AWSDescribeInstancesFilters.js')
const filterExistsAndNotEmpty = require('./internal/filterExistsAndNotEmpty')

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
 * @name EC2
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new EC2(options {
 *   ...({
 *     accessKeyId: string,
 *     secretAccessKey: string,
 *     region: string,
 *   })|({
 *     endpoint: string,
 *     region: string,
 *   })
 * }) -> EC2
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
 */
const EC2 = function (options) {
  this.awsEc2 = new AWSEC2({
    apiVersion: '2016-11-15',
    ...pick([
      'accessKeyId',
      'secretAccessKey',
      'region',
      'endpoint',
    ])(options),
  })
  return this
}

/**
 * @name EC2.prototype.listInstances
 *
 * @synopsis
 * ```coffeescript [specscript]
 * import EC2FindInstancesDescribeFilterOptions from './internal/EC2FindInstancesDescribeFilterOptions.ss'
 *
 * new EC2(...).listInstances(options? {
 *   ...EC2FindInstancesDescribeFilterOptions.map(value => value|Array<value>),
 *   limit?: 5-1000, // default 1000
 *   nextToken?: string, // last result's NextToken
 * }) -> Promise<{
 *   Instances: Array<FindInstanceResult>,
 *   NextToken: string|null,
 * }>
 *
 * FindInstanceResult {
 * }
 * ```
 */

EC2.prototype.listInstances = async function (options = {}) {
  const {
    Reservations: reservations,
    NextToken: nextToken,
  } = await this.awsEc2.describeInstances(filterExistsAndNotEmpty({
    Filters: AWSDescribeInstancesFilters(options),
    MaxResults: options.limit ?? 1000,
    NextToken: options.nextToken,
  })).promise()

  const instances = reservations.flatMap(get('Instances'))
  const instanceIds = instances.map(get('InstanceId'))

  const instanceIdStatusMap = new Map()
  let instanceIndex = 0
  while (instanceIndex < instanceIds.length) {
    const { InstanceStatuses: instanceStatuses } =
      await this.awsEc2.describeInstanceStatus({
        InstanceIds: instanceIds.slice(instanceIndex, (instanceIndex += 100)),
      }).promise()
    for (const instanceStatus of instanceStatuses) {
      instanceIdStatusMap.set(instanceStatus.InstanceId, instanceStatus)
    }
  }

  const instancesWithStatusFields = instances.map(instance => ({
    ...instance,
    ...instanceIdStatusMap.get(instance.InstanceId),
  }))

  return {
    Instances: instancesWithStatusFields,
    NextToken: nextToken,
  }
}

module.exports = EC2
