require('rubico/global')
const filterExists = require('./filterExists')
const objectFilterKeys = require('./objectFilterKeys')
const toArray = require('./toArray')

/**
 * @name createEC2DescribeInstancesFilters
 *
 * @docs
 * ```coffeescript [specscript]
 * import EC2ListInstancesDescribeFilterOptions from './EC2ListInstancesDescribeFilterOptions.ss'
 *
 * createEC2DescribeInstancesFilters(
 *   options EC2ListInstancesDescribeFilterOptions.map(value => value|Array<value>)
 * ) -> ec2DescribeInstancesFilters Array<{ Name: string, Values: Array }>
 * ```
 */
const createEC2DescribeInstancesFilters = pipe([
  options => ({
    'affinity': options.affinity,
    'architecture': options.architecture,
    'availability-zone': options.availabilityZone,
    'block-device-mapping.attach-time': options.blockDeviceMappingAttachTime,
    'block-device-mapping.delete-on-termination':
      options.blockDeviceMappingDeleteOnTermination,
    'block-device-mapping.device-name': options.blockDeviceMappingDeviceName,
    'block-device-mapping.status': options.blockDeviceMappingStatus,
    'block-device-mapping.volume-id': options.blockDeviceMappingVolumeId,
    'capacity-reservation-id': options.capacityReservationId,
    'client-token': options.clientToken,
    'dns-name': options.dnsName,
    'hibernation-options.configured': options.hibernationOptionsConfigured,
    'host-id': options.hostId,
    'hypervisor': options.hypervisor,
    'iam-instance-profile.arn': options.iamInstanceProfileArn,
    'image-id': options.imageId,
    'instance-id': options.instanceId,
    'instance-lifecycle': options.instanceLifecycle,
    'instance-state-code': options.instanceStateCode,
    'instance-state-name': options.instanceStateName,
    'instance-type': options.instanceType,
    'instance.group-id': options.instanceGroupId,
    'instance.group-name': options.instanceGroupName,
    'ip-address': options.ipAddress,
    'kernel-id': options.kernelId,
    'key-name': options.keyName,
    'launch-index': options.launchIndex,
    'launch-time': options.launchTime,
    'metadata-options.http-tokens': options.metadataOptionsHttpTokens,
    'metadata-options.http-put-response-hop-limit':
      options.metadataOptionsHttpPutResponseHopLimit,
    'metadata-options.http-endpoint': options.metadataOptionsHttpEndpoint,
    'monitoring-state': options.monitoringState,
    'network-interface.addresses.private-ip-address':
      options.networkInterfaceAddressesPrivateIpAddress,
    'network-interface.addresses.primary':
      options.networkInterfaceAddressesPrimary,
    'network-interface.addresses.association.public-ip':
      options.networkInterfaceAddressesAssociationPublicIp,
    'network-interface.addresses.association.ip-owner-id':
      options.networkInterfaceAddressesAssociationIpOwnerId,
    'network-interface.association.public-ip':
      options.networkInterfaceAssociationPublicIp,
    'network-interface.association.ip-owner-id':
      options.networkInterfaceAssociationIpOwnerId,
    'network-interface.association.allocation-id':
      options.networkInterfaceAssociationAllocationId,
    'network-interface.association.association-id':
      options.networkInterfaceAssociationId,
    'network-interface.attachment.attachment-id':
      options.networkInterfaceAttachmentId,
    'network-interface.attachment.instance-id':
      options.networkInterfaceAttachmentInstanceId,
    'network-interface.attachment.instance-owner-id':
      options.networkInterfaceAttachmentInstanceOwnerId,
    'network-interface.attachment.device-index':
      options.networkInterfaceAttachmentDeviceIndex,
    'network-interface.attachment.status':
      options.networkInterfaceAttachmentStatus,
    'network-interface.attachment.attach-time':
      options.networkInterfaceAttachTime,
    'network-interface.attachment.delete-on-termination':
      options.networkInterfaceAttachmentDeleteOnTermination,
    'network-interface.availability-zone':
      options.networkInterfaceAvailabilityZone,
    'network-interface.description': options.networkInterfaceDescription,
    'network-interface.group-id': options.networkInterfaceGroupId,
    'network-interface.group-name': options.networkInterfaceGroupName,
    'network-interface.ipv6-addresses.ipv6-address':
      options.networkInterfaceIpv6Address,
    'network-interface.mac-address': options.networkInterfaceMacAddress,
    'network-interface.network-interface-id': options.networkInterfaceId,
    'network-interface.owner-id': options.networkInterfaceOwnerId,
    'network-interface.private-dns-name':
      options.networkInterfacePrivateDnsName,
    'network-interface.requester-id': options.networkInterfaceRequesterId,
    'network-interface.requester-managed':
      options.networkInterfaceRequesterManaged,
    'network-interface.status': options.networkInterfaceStatus,
    'network-interface.source-dest-check':
      options.networkInterfaceSourceDestCheck,
    'network-interface.subnet-id': options.networkInterfaceSubnetId,
    'network-interface.vpc-id': options.networkInterfaceVpcId,
    'outpost-arn': options.outpostArn,
    'owner-id': options.ownerId,
    'placement-group-name': options.placementGroupName,
    'placement-partition-number': options.placementPartitionNumber,
    'platform': options.platform,
    'private-dns-name': options.privateDnsName,
    'private-ip-address': options.privateIpAddress,
    'product-code': options.productCode,
    'product-code.type': options.productCodeType,
    'ramdisk-id': options.ramdiskId,
    'reason': options.reason,
    'requester-id': options.requesterId,
    'reservation-id': options.reservationId,
    'root-device-name': options.rootDeviceName,
    'root-device-type': options.rootDeviceType,
    'source-dest-check': options.sourceDestCheck,
    'spot-instance-request-id': options.spotInstanceRequestId,
    'state-reason-code': options.stateReasonCode,
    'state-reason-message': options.stateReasonMessage,
    'subnet-id': options.subnetId,
    'tag-key': options.tagKey,
    'tenancy': options.tenancy,
    'virtualization-type': options.virtualizationType,
    'vpc-id': options.vpcId,
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

module.exports = createEC2DescribeInstancesFilters
