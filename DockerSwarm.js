require('rubico/global')
const Docker = require('./Docker')

/**
 * @name DockerSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm(advertiseAddr string) -> DockerSwarm
 * ```
 *
 * @description
 * DockerSwarm interface
 *
 * ## Resources
 * https://boxboat.com/2016/08/17/whats-docker-swarm-advertise-addr/
 */
const DockerSwarm = function (advertiseAddr) {
  this.advertiseAddr = advertiseAddr
  this.docker = new Docker()
  return this
}

/**
 * @name DockerSwarm.prototype.init
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm(...).init() -> Promise<>
 * ```
 */
DockerSwarm.prototype.init = async function init() {
  await this.docker.initSwarm(this.advertiseAddr).then(async response => {
    if (!response.ok) {
      throw new Error(await response.text())
    }
  })
  const swarmData = await this.inspect()
  this.workerJoinToken = swarmData.JoinTokens.Worker
  this.managerJoinToken = swarmData.JoinTokens.Manager
}

/**
 * @name DockerSwarm.prototype.join
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm(...).join(options {
 *   joinToken: string, // worker or manager join token
 *   remoteAddrs: Array<string>, // urls of manager nodes already participating in the swarm
 * }) -> Promise<>
 * ```
 */

DockerSwarm.prototype.join = async function join(options) {
  const { joinToken, remoteAddrs } = options
  await this.docker.joinSwarm(this.advertiseAddr, joinToken, {
    remoteAddrs,
  }).then(async response => {
    if (!response.ok) {
      throw new Error(await response.text())
    }
  })
}

// DockerSwarm(address).inspect() -> Promise<Object>
DockerSwarm.prototype.inspect = function dockerSwarmInspect() {
  return this.docker.inspectSwarm().then(response => response.json())
}

// DockerSwarm(address).leave(options? { force: boolean }) -> Promise<Object>
DockerSwarm.prototype.leave = function dockerSwarmLeave(options) {
  return this.docker.leaveSwarm(options)
    .then(fork({ message: response => response.text() }))
}

/**
 * @name DockerSwarm.prototype.update
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm(options).update({
 *   rotateWorkerToken: boolean, // whether to rotate worker token
 *   rotateManagerToken: boolean, // whether to rotate manager token
 *   rotateManagerUnlockKey: boolean, // whether to rotate unlock key
 *   taskHistoryLimit: 10|number, // number of tasks revisions to retain for rollbacks
 *   dispatcherHeartbeat: 5000000000|number, // nanoseconds delay for agent to ping dispatcher
 *   autolock: false|true, // whether to lock managers when they stop
 *   certExpiry: 7776000000000000|number, // validity period in nanoseconds for node certs
 *   snapshotInterval: 10000|number, // number of log entries between raft snapshots
 *   keepOldSnapshots: 0|number, // number of snapshots to keep beyond current snapshot
 *   logEntriesForSlowFollowers: 500|number, // number of log entries to retain to sync up slow followers after snapshot creation
 *   electionTick: 3|number, // number of ticks a follower will wait before starting a new election. Must be greater than heartbeatTick
 *   heartbeatTick: 1|number, // number of ticks between heartbeats. One tick ~ one second
 * })
 * ```
 *
 * @description
 * https://docs.docker.com/engine/api/v1.40/#operation/SwarmUpdate
 * https://docs.docker.com/engine/reference/commandline/swarm_update/
 *
 * @deprecated
DockerSwarm.prototype.update = async function dockerSwarmUpdate(options) {
  await this.ready
  return this.docker.updateSwarm({
    version: this.version,
    spec: this.spec,
    ...options,
  })
} */

module.exports = DockerSwarm
