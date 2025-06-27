require('rubico/global')
const AWSAutoscaling = require('./aws-sdk/clients/autoscaling')
const AWSAutoScalingDescribeAutoScalingGroupsFilters =
  require('./internal/AWSAutoScalingDescribeAutoScalingGroupsFilters')
const filterExistsAndNotEmpty = require('./internal/filterExistsAndNotEmpty')
const filterExists = require('./internal/filterExists')

/**
 * @name AutoScaling
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new AutoScaling(options {
 *   ...({
 *     accessKeyId: string,
 *     secretAccessKey: string,
 *     region: string,
 *   })|({
 *     endpoint: string,
 *     region: string,
 *   })
 * }) -> AutoScaling object
 * ```
 */
const AutoScaling = function (options) {
  this.awsAutoScaling = new AWSAutoscaling({
    apiVersion: '2011-01-01',
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
 * @name AutoScaling.prototype.listAutoScalingGroups
 *
 * @synopsis
 * ```coffeescript [specscript]
 * import AutoScalingListGroupsDescribeFilterOptions
 *   from './internal/AutoScalingListGroupsDescribeFilterOptions.ss'
 *
 * new AutoScaling(...).listAutoScalingGroups(options? {
 *   ...AutoScalingListGroupsDescribeFilterOptions.map(value => value|Array<value>),
 *   limit?: 5-100, // default 100
 *   nextToken?: string, // last result's NextToken
 * }) -> Promise<{
 *   AutoScalingGroups: Array<{
 *     AutoScalingGroupName: string, // 'presidium-test'
 *     AutoScalingGroupARN: string, // 'arn:aws:autoscaling:us-west-1:095798571722:autoScalingGroup:934690c8-d95d-46be-ac49-54950de41ef5:autoScalingGroupName/presidium-test'
 *     LaunchTemplate: Object,
 *     MinSize: number, // 1
 *     MaxSize: number, // 1
 *     DesiredCapacity: number, // 1
 *     DefaultCooldown: number, // 300
 *     AvailabilityZones: Array,
 *     LoadBalancerNames: Array,
 *     TargetGroupARNs: Array,
 *     HealthCheckType: string, // 'EC2'
 *     HealthCheckGracePeriod: number, // 300
 *     Instances: Array,
 *     CreatedTime: Date, // 2022-04-28T20:26:13.289Z
 *     SuspendedProcesses: Array,
 *     VPCZoneIdentifier: string, // 'subnet-916bb8f7,subnet-677c933d'
 *     EnabledMetrics: Array,
 *     Tags: Array,
 *     TerminationPolicies: Array,
 *     NewInstancesProtectedFromScaleIn: boolean,
 *     ServiceLinkedRoleARN: string, // 'arn:aws:iam::095798571722:role/aws-service-role/autoscaling.amazonaws.com/AWSServiceRoleForAutoScaling'
 *   }>,
 *   NextToken: string|null,
 * }>
 * ```
 */
AutoScaling.prototype.listAutoScalingGroups = function (options = {}) {
  return this.awsAutoScaling.describeAutoScalingGroups(filterExistsAndNotEmpty({
    Filters: AWSAutoScalingDescribeAutoScalingGroupsFilters(options),
    MaxRecords: options.limit ?? 100,
    NextToken: options.nextToken,
  })).promise()
}

/**
 * @name AutoScaling.prototype.setDesiredCapacity
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new AutoScaling(...).setDesiredCapacity(options {
 *   autoScalingGroupName: string,
 *   desiredCapacity: number,
 *   honorCooldown?: boolean, // whether Amazon EC2 Auto Scaling waits for the cooldown period to complete before initializing a scaling activity to set your Auto Scaling group to its new capacity, default false
 * }) -> Promise<{}>
 * ```
 */
AutoScaling.prototype.setDesiredCapacity = function (options) {
  return this.awsAutoScaling.setDesiredCapacity(filterExists({
    AutoScalingGroupName: options.autoScalingGroupName,
    DesiredCapacity: options.desiredCapacity,
    HonorCooldown: options.honorCooldown,
  })).promise()
}

module.exports = AutoScaling
