const rubico = require('rubico')
const AWSEC2 = require('aws-sdk/clients/ec2')
const AWSEC2DescribeInstancesFilters = require('./internal/AWSEC2DescribeInstancesFilters.js')
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
 * import EC2ListInstancesDescribeFilterOptions from './internal/EC2ListInstancesDescribeFilterOptions.ss'
 *
 * new EC2(...).listInstances(options? {
 *   ...EC2ListInstancesDescribeFilterOptions.map(value => value|Array<value>),
 *   limit?: 5-1000, // default 1000
 *   nextToken?: string, // last result's NextToken
 * }) -> Promise<{
 *   Instances: Array<{
 *     InstanceId: string,
 *     AmiLaunchIndex: number, // 0
 *     ImageId: string, // 'ami-09625adacc474a7b4'
 *     InstanceId: 'i-04a9d2103428c73c0'
 *     InstanceType: string, // 't2.micro'
 *     KeyName: string, // 'solumlibs-test'
 *     LaunchTime: Date, // 2022-04-28T17:08:41.000Z
 *     Monitoring: {
 *       State: string, // 'disabled'
 *     },
 *     Placement: {
 *       AvailabilityZone: string, // 'us-west-1a'
 *       GroupName: string, // ''
 *       Tenancy: string, // 'default'
 *     },
 *     PrivateDnsName: string, // 'ip-172-31-31-44.us-west-1.compute.internal'
 *     PrivateIpAddress: string, // '172.31.31.44'
 *     ProductCodes: Array<string>,
 *     PublicDnsName: string, // 'ec2-3-101-88-163.us-west-1.compute.amazonaws.com'
 *     PublicIpAddress: string, // '3.101.88.163'
 *     State: {
 *       Code: number, // 16
 *       Name: string, // 'running'
 *     },
 *     StateTransitionReason: string,
 *     SubnetId: string, // 'subnet-916bb8f7'
 *     VpcId: string, // 'vpc-9c42a2fa'
 *     Architecture: string, // 'x86_64'
 *     BlockDeviceMappings: Array<Object>,
 *     ClientToken: string,
 *     EbsOptimized: boolean,
 *     EnaSupport: boolean,
 *     Hypervisor: string, // 'xen'
 *     ElasticGpuAssociations: Array,
 *     ElasticInferenceAcceleratorAssociations: Array,
 *     NetworkInterfaces: Array<Object>,
 *     RootDeviceName: string, // '/dev/xvda'
 *     RootDeviceType: string, // 'ebs'
 *     SecurityGroups: Array<Object>,
 *     SourceDestCheck: boolean,
 *     Tags: Array<Object>,
 *     VirtualizationType: string, // 'hvm'
 *     CpuOptions: {
 *       CoreCount: number, // 1
 *       ThreadsPerCore: number, // 1
 *     },
 *     CapacityReservationSpecification: {
 *       CapacityReservationPreference: string, // 'open'
 *     },
 *     HibernationOptions: {
 *       Configured: boolean, // false
 *     },
 *     Licenses: [],
 *     MetadataOptions: {
 *       State: string, // 'applied'
 *       HttpTokens: string, // 'optional'
 *       HttpPutResponseHopLimit: number, // 1
 *       HttpEndpoint: string, // 'enabled'
 *     },
 *     EnclaveOptions: {
 *       Enabled: boolean, // false
 *     },
 *     AvailabilityZone: string, // 'us-west-1a'
 *     Events: Array,
 *     InstanceState: {
 *       Code: number, // 16
 *       Name: string, // 'running'
 *     },
 *     InstanceStatus: {
 *       Details: Array,
 *       Status: string, // 'ok'
 *     },
 *     SystemStatus: {
 *       Details: Array,
 *       Status: string, // 'ok'
 *     }
 *   }>,
 *   NextToken: string|null,
 * }>
 * ```
 */

EC2.prototype.listInstances = async function (options = {}) {
  const {
    Reservations: reservations,
    NextToken: nextToken,
  } = await this.awsEc2.describeInstances(filterExistsAndNotEmpty({
    Filters: AWSEC2DescribeInstancesFilters(options),
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
        IncludeAllInstances: true,
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
