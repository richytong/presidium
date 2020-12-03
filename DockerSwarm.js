const Docker = require('./Docker')

/**
 * @name DockerSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm({
 *   advertiseAddr: string, // externally reachable address
 *   listenAddr: string, // address for inter-manager communication
 *   availability: 'active'|'pause'|'drain',
 *   subnetSize: number,
 *   dataPathAddr: advertiseAddr|string, // address for data path traffic
 *   dataPathPort: 4789|number, // port for data path traffic
 *   defaultAddrPool: Array<string>,
 *   forceNewCluster: boolean, // force create a new cluster from current state
 * })
 * ```
 *
 * @description
 * ```json
 * {
 *   "ListenAddr": "0.0.0.0:2377",
 *   "AdvertiseAddr": "192.168.1.1:2377",
 *   "DataPathPort": 4789,
 *   "DefaultAddrPool": [
 *     "10.10.0.0/8",
 *     "20.20.0.0/8"
 *   ],
 *   "SubnetSize": 24,
 *   "ForceNewCluster": false,
 *   "Spec": {
 *     "Orchestration": {},
 *     "Raft": {},
 *     "Dispatcher": {},
 *     "CAConfig": {},
 *     "EncryptionConfig": {
 *       "AutoLockManagers": false
 *     }
 *   }
 * }
 * ```
 */
const DockerSwarm = function () {
  if (this == null || this.constructor != DockerSwarm) {
    return new DockerSwarm()
  }
  this.docker = new Docker()
  this.version = null
  this.synchronizing = this.synchronize()
  return this
}

// new DockerSwarm().synchronize() -> Promise<>
DockerSwarm.prototype.synchronize = function () {
  this.synchronizing = this.docker.inspectSwarm().then(pipe([
    response => response.json(),
    ({ Version }) => {
      this.version = Version.Index
    },
  ]))
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
 */
DockerSwarm.prototype.update = async function dockerSwarmUpdate(options) {
  await this.synchronizing
  return this.docker.updateSwarm({ version: this.version, ...options })
    .then(pipe([
      response => response.json(),
      tap(console.log),
    ]))
}
