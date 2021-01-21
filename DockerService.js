const assert = require('assert')
const rubico = require('rubico')
const Docker = require('./Docker')
const stringifyJSON = require('./internal/stringifyJSON')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const trace = require('rubico/x/trace')
const split = require('./internal/split')
const join = require('./internal/join')
const inspect = require('util').inspect

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

const dockerServiceOptions = [
  'name', 'image', 'replicas', 'publish', 'mounts',
  'cmd', 'workdir', 'env', 'restart', 'restartDelay',
  'logDriver', 'logDriverOptions',
  'healthCmd', 'healthInterval',
  'healthTimeout', 'healthRetries', 'healthStartPeriod',
  'updateParallelism', 'updateDelay',
  'updateFailureAction', 'updateMonitor', 'updateMaxFailureRatio',
  'rollbackParallelism', 'rollbackDelay',
  'rollbackFailureAction', 'rollbackMonitor', 'rollbackMaxFailureRatio',
  'username', 'password', 'email', 'serveraddress', 'identitytoken',
]

/**
 * @name DockerService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService({
 *   name: string,
 *   image: string,
 *   replicas: 1|number,
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   restartDelay: 10e9|number, // nanoseconds to delay between restarts
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Object<(hostPort string)=>(containerPort string)>,
 *   healthCmd: Array<string>, // healthcheck command. See description
 *   healthInterval: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *   healthTimeout: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *   healthRetries: 5|number, // number of retries before unhealhty
 *   healthStartPeriod: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   mounts: Array<{
 *     source: string, // name of volume
 *     target: string, // mounted path inside container
 *     readonly: boolean,
 *   }>|Array<string>, // '<source>:<target>[:readonly]'
 *
 *   updateParallelism: 2|number, // maximum number of tasks updated simultaneously
 *   updateDelay: 1e9|number, // ns delay between updates
 *   updateFailureAction: 'pause'|'continue'|'rollback',
 *   updateMonitor: 15e9|number, // ns after each task update to monitor for failure
 *   updateMaxFailureRatio: 0.15|number, // failure rate to tolerate during an update
 *
 *   rollbackParallelism: 2|number, // maximum number of tasks rolledback simultaneously
 *   rollbackDelay: 1e9|number, // ns delay between task rollbacks
 *   rollbackFailureAction: 'pause'|'continue',
 *   rollbackMonitor: 15e9|number, // ns after each task rollback to monitor for failure
 *   rollbackMaxFailureRatio: 0.15|number, // failure rate to tolerate during a rollback
 *
 *   cmd: Array<string|number>, // CMD
 *   workdir: path string, // WORKDIR
 *   env: {
 *     HOME: string,
 *     HOSTNAME: string,
 *     PATH: string, // $PATH
 *     ...(moreEnvOptions Object<string>),
 *   }, // ENV; environment variables exposed to container during run time
 *
 *   // auth options
 *   username: string,
 *   password: string,
 *   email?: string,
 *   serveraddress?: string,
 *   identitytoken?: string,
 * }) -> DockerService
 * ```
 *
 * @description
 * One Docker swarm = N Docker services = N ports exposed on every host
 *
 * ```javascript
 * DockerService('my-image:latest', '[::1]:2377')
 * ```
 */
const DockerService = function (options) {
  if (this == null || this.constructor != DockerService) {
    return new DockerService(options)
  }
  this.name = options.name
  this.docker = new Docker()
  this.version = null
  this.spec = null
  this.ready = this.docker.inspectService(this.name).then(pipe([
    switchCase([
      eq(404, get('status')),
      () => this.docker.createService(
        this.name,
        pick(dockerServiceOptions)(options)),
      pipe([
        tap(() => this.synchronize()),
        () => this.docker.updateService(
          this.name,
          pick(dockerServiceOptions)(options)),
      ]),
    ]),
    tap(() => this.synchronize()),
  ]))
  return this
}

// new DockerService().synchronize() -> Promise<>
DockerService.prototype.synchronize = function dockerServiceSynchronize() {
  return this.docker.inspectService(this.name).then(pipe([
    tap(response => assert(response.ok, response.statusText)),
    response => response.json(),
    body => {
      this.version = body.Version.Index
      this.spec = body.Spec
    },
  ]))
}

/**
 * @name DockerService.prototype.update
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(name).update(options {
 *   version: number, // current version of service
 *   registryAuthFrom: 'spec'|'previous-spec', // where to look for auth if no X-Registry-Auth
 *   rollback: 'previous', // roll service back to previous version
 *
 *   image: string,
 *   replicas: 1|number,
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   restartDelay: 10e9|number, // nanoseconds to delay between restarts
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Object<(hostPort string)=>(containerPort string)>,
 *   healthCmd: Array<string>, // healthcheck command. See description
 *   healthInterval: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *   healthTimeout: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *   healthRetries: 5|number, // number of retries before unhealhty
 *   healthStartPeriod: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   mounts: Array<{
 *     source: string, // name of volume
 *     target: string, // mounted path inside container
 *     readonly: boolean,
 *   }>|Array<string>, // '<source>:<target>[:readonly]'
 *
 *   cmd: Array<string|number>, // CMD
 *   workdir: path string, // WORKDIR
 *   env: {
 *     HOME: string,
 *     HOSTNAME: string,
 *     PATH: string, // $PATH
 *     ...(moreEnvOptions Object<string>),
 *   }, // ENV; environment variables exposed to container during run time
 * }) -> Promise<Object>
 * ```
 */

DockerService.prototype.update = async function dockerServiceUpdate(options) {
  await this.ready
  return this.docker.updateService(this.name, {
    ...options,
    spec: this.spec,
    version: this.version,
  }).then(response => {
    this.ready = this.synchronize()
    return response.json()
  })
}

DockerService.prototype.inspect = async function dockerServiceInspect() {
  await this.ready
  return this.docker.inspectService(this.name)
    .then(response => response.json())
}

module.exports = DockerService
