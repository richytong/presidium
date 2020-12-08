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
 * new DockerSwarm(address string) -> DockerSwarm
 * ```
 *
 * @description
 * `address` is either the advertise address (`.init`) or the advertise address of an existing host (`.join`)
 */
const DockerSwarm = function (address, token) {
  if (this == null || this.constructor != DockerSwarm) {
    return new DockerSwarm(address)
  }
  this.address = address
  this.docker = new Docker()
  this.version = null
  this.spec = null
  this.ready = this.docker.inspectSwarm().then(switchCase([
    or([
      eq(404, get('status')),
      eq(503, get('status')),
    ]),
    token == null ? async () => {
      await this.docker.initSwarm(address)
      await this.synchronize()
    } : async () => {
      await this.docker.joinSwarm(address, token)
      await this.synchronize()
    },
    async response => {
      const body = await response.json()
      this.version = body.Version.Index
      this.spec = body.Spec
    },
  ]))
  this.version = null
  return this
}

// new DockerSwarm().synchronize() -> Promise<>
DockerSwarm.prototype.synchronize = function dockerServiceSynchronize() {
  return this.docker.inspectSwarm().then(pipe([
    tap(response => assert(response.ok, response.statusText)),
    response => response.json(),
    body => {
      this.version = body.Version.Index
      this.spec = body.Spec
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
