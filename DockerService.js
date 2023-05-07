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
const stream = require('stream')

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

const passthrough = target => transform(map(identity), target)

const PassThroughStream = stream.PassThrough

const dockerServiceOptions = [
  'name', 'image', 'replicas', 'publish', 'mounts', 'labels',
  'cmd', 'workdir', 'env', 'restart', 'restartDelay',
  'logDriver', 'logDriverOptions',
  'healthCmd', 'healthInterval',
  'healthTimeout', 'healthRetries', 'healthStartPeriod',
  'updateParallelism', 'updateDelay',
  'updateFailureAction', 'updateMonitor', 'updateMaxFailureRatio',
  'rollbackParallelism', 'rollbackDelay',
  'rollbackFailureAction', 'rollbackMonitor', 'rollbackMaxFailureRatio',
  'username', 'password', 'email', 'serveraddress', 'identitytoken',
  'network', 'memory', 'cpus',
  'force',
]

/**
 * @name DockerService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService({
 *   name: string,
 *   image: string,
 *   replicas: 'global'|1|number,
 *   restart: 'no'|'on-failure[:<max-retries>]'|'any',
 *   restartDelay: 10e9|number, // nanoseconds to delay between restarts
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Object<(hostPort string)=>(containerPort string)>,
 *   healthCmd: Array<string>, // healthcheck command. See description
 *   healthInterval: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *   healthTimeout: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *   healthRetries: 5|number, // number of retries before unhealhty
 *   healthStartPeriod: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   memory: number, // memory limit in bytes
 *   cpus: number, // number of cpus
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
 *   network?: string, // name or id of network to attach service
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
 *
 *   force?: boolean,
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
  this.serviceOptions = pick(dockerServiceOptions)(options)
  this.name = options.name
  this.docker = new Docker()
  this.version = null
  this.spec = null
  this.replicas = options.replicas
  this.image = options.image
  this.env = options.env
  return this
}

/**
 * @name DockerService.prototype.deploy
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(...).deploy(options {
 *   force?: boolean,
 * }) -> Promise<>
 * ```
 */
DockerService.prototype.deploy = async function deploy(options = {}) {
  const inspectServiceResponse = await this.docker.inspectService(this.name)

  // create service on not found
  if (inspectServiceResponse.status == 404) {
    const { name, serviceOptions } = this
    const response = await this.docker.createService(name, serviceOptions)
    if (options.waitFor) {
      await this.waitFor()
    }
    if (!response.ok) {
      throw new Error(await response.text())
    }
    return { message: 'success', didCreate: true }
  }

  // service exists
  if (inspectServiceResponse.ok) {
    const updateResponse = await this.update({
      ...this.serviceOptions,
      ...pick(['force'])(options),
    })
    if (options.waitFor) {
      await this.waitFor()
    }
    return {
      message: 'success',
      didUpdate: true,
      warnings: updateResponse.Warnings,
    }
  }

  // other error
  const error = new Error(`Docker Error: ${await inspectServiceResponse.text()}`)
  error.code = inspectServiceResponse.status
  throw error
}

// new DockerService().waitFor() -> Promise<>
DockerService.prototype.waitFor = async function waitFor() {
  let nextTasks = await this.docker.listTasks().then(pipe([
    async response => {
      if (response.ok) {
        return response.json()
      }
      throw new Error(await response.text())
    },
    filter(not(eq('shutdown', get('DesiredState')))),
  ]))
  while (nextTasks.every(not(eq('running', get('Status.State'))))) {
    await new Promise(resolve => setTimeout(resolve, 500))
    nextTasks = await this.docker.listTasks().then(pipe([
      async response => {
        if (response.ok) {
          return response.json()
        }
        throw new Error(await response.text())
      },
      filter(not(eq('shutdown', get('DesiredState')))),
    ]))
  }
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
 *   replicas: 'global'|number,
 *   restart: 'no'|'on-failure[:<max-retries>]'|'any',
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
 *
 *   force?: boolean,
 * }) -> Promise<Object>
 * ```
 */

DockerService.prototype.update = async function update(options) {
  await this.synchronize()
  return this.docker.updateService(this.name, {
    ...options,
    spec: this.spec,
    version: this.version,
  }).then(async response => {
    if (response.ok) {
      return response.json()
    }
    throw new Error(await response.text())
  })
}

/**
 * @name DockerService.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService(...).inspect() -> Promise<{}>
 * ```
 */
DockerService.prototype.inspect = async function inspect() {
  await this.ready
  return this.docker.inspectService(this.name)
    .then(response => response.json())
}

/**
 * @name DockerService.prototype.getLogs
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService(options).getLogs(options {
 *   stdout: boolean, // return logs from stdout, default false
 *   stderr: boolean, // return logs from stderr, default false
 *   follow: boolean, // keep connection after returning logs, default false
 *   since: number, // unix timestamp, 1612543950742
 *   timestamps: boolean, // add timestamps to every log line
 *   tail: 'all'|number, // only return this number of log lines from the end of logs.
 * }) -> PassThroughStream
 * ```
 *
 * @description
 * https://docs.docker.com/engine/api/v1.40/#operation/ServiceLogs
 */
DockerService.prototype.getLogs = async function getLogs(options) {
  await this.ready
  const result = new PassThroughStream()
  result.promise = new Promise((resolve, reject) => {
    this.docker.getServiceLogs(this.name, pick([
      'stdout', 'stderr', 'follow',
      'since', 'timestamps', 'tail',
    ])(options)).then(response => {
      response.body.on('end', resolve)
      response.body.on('error', reject)
      response.body.pipe(result)
    })
  })
  return result
}

module.exports = DockerService
