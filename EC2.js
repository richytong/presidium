require('rubico/global')
const EC2Client = require('aws-sdk/clients/ec2')
require('aws-sdk/lib/maintenance_mode_message').suppress = true
const createEC2DescribeInstancesFilters = require('./internal/createEC2DescribeInstancesFilters.js')
const filterExistsAndNotEmpty = require('./internal/filterExistsAndNotEmpty')

/**
 * @name EC2
 *
 * @docs
 * ```coffeescript [specscript]
 * new EC2(options {
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   region: string,
 *   endpoint: string
 * }) -> ec2 EC2
 * ```
 *
 * @description
 * https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
 */
class EC2 {
  constructor(options) {
    const awsCreds = {
      ...pick(options, [
        'accessKeyId',
        'secretAccessKey',
        'endpoint'
      ]),
      region: options.region ?? 'default-region',
    }

    this.client = new EC2Client({
      ...awsCreds,
      apiVersion: '2016-11-15',
    })
  }

  /**
   * @name listInstances
   *
   * @docs
   * ```coffeescript [specscript]
   * ec2.listInstances(options {
   *   affinity: 'default'|'host',
   *   architecture: 'i386'|'x86_64'|'arm64',
   *   availabilityZone: string,
   *   blockDeviceMappingAttachTime: string, // e.g. '2010-09-15T17:15:20.000Z'
   *   blockDeviceMappingDeleteOnTermination: boolean, // whether EBS volume is deleted on instance termination
   *   blockDeviceMappingDeviceName: string, // device name specified in the block mapping e.g. /dev/sdh or xvdh
   *   blockDeviceMappingStatus: 'attaching'|'attached'|'detaching'|'detached',
   *   blockDeviceMappingVolumeId: string, // volume ID of the EBS volume
   *   capacityReservationId: string, // ID of the Capacity Reservation into which the instance was launched
   *   clientToken: string, // idempotency token you provided when you launched the instance
   *   dnsName: string, // public DNS name of the instance
   *   hibernationOptionsConfigured: boolean, // whether instance is enabled for hibernation
   *   hostId: string, // ID of the dedicated host on which the instance is running
   *   hypervisor: 'ovm'|'xen', // 'xen' is used for both Xen and Nitro hypervisors
   *   iamInstanceProfileArn: string, // ARN of the instance profile associated with the instance
   *   imageId: string, // ID of the image used to launch the instance 
   *   instanceId: string, // ID of the instance
   *   instanceLifecycle: 'spot'|'scheduled', // whether this is a Spot or Scheduled instance
   *   instanceStateCode: 0|16|32|48|64|80, // state of the instance as a 16 bit unsigned int: 0 - pending; 16 - running; 32 - shutting-down; 48 - terminated; 64 - stopping; 80 - stopped
   *   instanceStateName: 'pending'|'running'|'shutting-down'|'terminated'|'stopping'|'stopped', // state of the instance
   *   instanceType: string, // type of the instance, e.g. 't2.micro'
   *   instanceGroupId: string, // ID of the security group for the instance
   *   instanceGroupName: string, // name of the security group for the instance
   *   ipAddress: string, // public IPv4 address of the instance
   *   kernelId: string, // kernel ID
   *   keyName: string, // name of the key pair used when the instance was launched
   *   launchIndex: number, // when launching multiple instances, index for the instance in the launch group e.g. 0, 1, 2
   *   launchTime: string, // time when the instance was launched in ISO 8601 format in UTC (YYYY-MM-DDThh:mm:ss.sssZ). Wildcard `*` (2021-09-29T*) matches an entire day
   *   metadataOptionsHttpTokens: 'optional'|'required', // metadata request authorization state
   *   metadataOptionsHttpPutResponseHopLimit: 1-64, // http metadata request put response hop limit
   *   metadataOptionsHttpEndpoint: 'enabled'|'disabled', // enable or disable metadata access on http endpoint
   *   monitoringState: 'enabled'|'disabled', // whether detailed monitoring is enabled
   *   networkInterfaceAddressesPrivateIpAddress: string, // private IPv4 address associated with the network interface
   *   networkInterfaceAddressesPrimary: boolean, // whether the IPv4 address of the network interface is the primary private IPv4 address
   *   networkInterfaceAddressesAssociationPublicIp: string, // ID of the association of an IPv4 Elastic IP Address with a network interface
   *   networkInterfaceAddressesAssociationIpOwnerId: string, // owner ID of the private IPv4 address associated with the network interface
   *   networkInterfaceAssociationPublicIp: string, // address of the Elastic IPv4 address bound to the network interface
   *   networkInterfaceAssociationIpOwnerId: string, // ownern of the Elastic IPv4 address associated with the network interface
   *   networkInterfaceAssociationAllocationId: string, // allocation ID returned when you allocated the IPv4 Elastic IP Address for your network interface
   *   networkInterfaceAssociationId: string, // association ID returned when the network interface was associated with an IPv4 address
   *   networkInterfaceAttachmentId: string, // ID of the interface attachment
   *   networkInterfaceAttachmentInstanceId: string, // ID of the instance to which the network interface is attached
   *   networkInterfaceAttachmentInstanceOwnerId: string, // owner ID of the instance to which the network interface is attached
   *   networkInterfaceAttachmentDeviceIndex: number, // device index to which the network interface is attached
   *   networkInterfaceAttachmentStatus: 'attaching'|'attached'|'detaching'|'detached',
   *   networkInterfaceAttachTime: string, // ISO 8601 string for time when network interface was attached to an instance
   *   networkInterfaceAttachmentDeleteOnTermination: boolean, // whether the attachment is deleted when an instance is terminated
   *   networkInterfaceAvailabilityZone: string, // Availability Zone of the network interface
   *   networkInterfaceDescription: string, // description of the network interface
   *   networkInterfaceGroupId: string, // ID of a security group associated with the network interface
   *   networkInterfaceGroupName: string, // name of a security group associated with the network interface
   *   networkInterfaceIpv6Address: string, // IPv6 address associated with the network interface
   *   networkInterfaceMacAddress: string, // MAC address of the network interface
   *   networkInterfaceId: string, // ID of the network interface
   *   networkInterfaceOwnerId: string, // ID of the owner of the network interface
   *   networkInterfacePrivateDnsName: string, // private DNS name of the network interface
   *   networkInterfaceRequesterId: string, // requester ID of the network interface
   *   networkInterfaceRequesterManaged: boolean, // whether the network interface is being managed by AWS
   *   networkInterfaceStatus: 'available'|'in-use',
   *   networkInterfaceSourceDestCheck: boolean, // whether network interface performs source/destination checking, must be false for the network interface to perform network address translation (NAT) in your VPC
   *   networkInterfaceSubnetId: string, // ID of the subnet for the network interface
   *   networkInterfaceVpcId: string, // ID of the vpc for the network interface
   *   outpostArn: string, // ARN of the Outpost
   *   ownerId: string, // the AWS account ID of the instance's owner
   *   placementGroupName: string, // name of the placement group for the instance
   *   placementPartitionNumber: number, // partition in which the instance is located
   *   platform: 'Windows', // platform, only valid value is 'Windows'
   *   privateDnsName: string, // private IPv4 DNS name of the instance
   *   privateIpAddress: string, // private IPv4 address of the instance
   *   productCode: string, // product code associated with the AMI used to launch the instance
   *   productCodeType: 'devpay'|'marketplace', // type of the product code
   *   ramdiskId: string, // RAM disk ID
   *   reason: string, // reason for the current state of the instance, e.g. 'User Initiated [date]' when you stop or terminate an instance
   *   requesterId: string, // ID of the entity that launched the instance on your behalf, e.g. 'Amazon Web Services Management Console' or 'Auto Scaling'
   *   reservationId: string, // ID of the instance's reservation. A reservation ID has 1:1 relationship with an instance launch request. An instance launch request can have multiple instances
   *   rootDeviceName: string, // device name of the root device volume e.g. '/dev/sda1'
   *   rootDeviceType: 'ebs'|'instance-store', // type of the root device volume
   *   sourceDestCheck: boolean, // whether instance performs source/destination checking. Must be false for instance to perform network address translation (NAT) in your VPC
   *   spotInstanceRequestId: string, // ID of the spot instance reequest
   *   stateReasonCode: string, // reason code for the state change
   *   stateReasonMessage: string, // message the describes the state change
   *   subnetId: string, // ID of the subnet for the instance
   *   `tag:${key string}`: string, // key/value combination of a tag assigned to the resource. For example, to find all resources that have a tag with key `Owner` and value `TeamA`, specify `tag:Owner` with value `TeamA`
   *   tagKey: string, // key of a tag assigned to the resource. Use to find all resources with a specific tag, regardless of the value
   *   tenancy: 'dedicated'|'default'|'host', // tenancy of the instance
   *   virtualizationType: 'paravirtual'|'hvm', // virtualization type of the instance
   *   vpcId: string, // ID of the VPC that the instance is running in
   *   limit: number,
   *   nextToken: string
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
   *     InstanceState: { // the intended state of the instance
   *       Code: number, // 16
   *       Name: string, // 'running'
   *     },
   *     InstanceStatus: { // reports impaired functionality that stems from issues internal to the instance, such as impaired reachability
   *       Details: Array,
   *       Status: string, // 'ok'
   *     },
   *     SystemStatus: { // reports impaired functionality that stems from issues related to systems that support the instance, such as hardware failures and network connectivity problems
   *       Details: Array,
   *       Status: string, // 'ok'
   *     }
   *   }>,
   *   NextToken: string
   * }>
   * ```
   */
  async listInstances(options = {}) {

    const {
      Reservations: reservations,
      NextToken: nextToken,
    } = await this.client.describeInstances(filterExistsAndNotEmpty({
      Filters: createEC2DescribeInstancesFilters(options),
      MaxResults: options.limit ?? 1000,
      NextToken: options.nextToken,
    })).promise()

    const instances = reservations.flatMap(get('Instances'))
    const instanceIds = instances.map(get('InstanceId'))

    const instanceIdStatusMap = new Map()
    let instanceIndex = 0

    while (instanceIndex < instanceIds.length) {
      const { InstanceStatuses: instanceStatuses } =
        await this.client.describeInstanceStatus({
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

  /**
   * @name terminateInstances
   *
   * @docs
   * ```coffeescript [specscript]
   * ec2.terminateInstances(InstanceIds Array<string>) ->
   *   response Promise<{ TerminatingInstances: Array<{}> }>
   * ```
   */
  terminateInstances(InstanceIds) {
    return this.client.terminateInstances({ InstanceIds }).promise()
  }
}

module.exports = EC2
