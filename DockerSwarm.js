const assert = require('assert')
const rubico = require('rubico')
const Docker = require('./Docker')

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

/**
 * @name DockerSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerSwarm(
 *   advertiseAddr string, // url advertised to other nodes, e.g. 'eth0:2377'
 *   options {
 *     joinToken: string, // worker or manager join token
 *     remoteAddrs: Array<string>, // urls of manager nodes already participating in the swarm
 *   },
 * ) -> DockerSwarm
 * ```
 */
const DockerSwarm = function (advertiseAddr, options = {}) {
  if (this == null || this.constructor != DockerSwarm) {
    return new DockerSwarm(advertiseAddr, options)
  }
  this.docker = new Docker()
  this.ready = this.docker.inspectSwarm().then(switchCase([
    or([
      eq(404, get('status')),
      eq(503, get('status')),
    ]),
    options.joinToken == null ? async () => {
      await this.docker.initSwarm(advertiseAddr)
      await this.synchronize()
    } : async () => {
      const response = await this.docker.joinSwarm(advertiseAddr, options.joinToken, {
        remoteAddrs: options.remoteAddrs,
      })
      if (!response.ok) {
        throw new Error(await response.text())
      }
    },
    async response => {
      const data = await response.json()
      this.version = data.Version.Index
      this.spec = data.Spec
      this.swarmData = data
    },
  ]))
  this.version = null
  this.spec = null
  this.swarmData = null
  return this
}

// new DockerSwarm().synchronize() -> Promise<>
DockerSwarm.prototype.synchronize = function dockerServiceSynchronize() {
  return this.docker.inspectSwarm().then(pipe([
    tap(async response => {
      if (!response.ok) {
        throw new Error(await response.text())
      }
    }),
    response => response.json(),
    data => {
      this.version = data.Version.Index
      this.spec = data.Spec
      this.swarmData = data
    },
  ]))
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
 */
DockerSwarm.prototype.update = async function dockerSwarmUpdate(options) {
  await this.ready
  return this.docker.updateSwarm({
    version: this.version,
    spec: this.spec,
    ...options,
  }).then(pipe.sync([
    tap.sync(() => {
      this.ready = this.synchronize()
    }),
    always(this.spec),
  ]))
}

module.exports = DockerSwarm
