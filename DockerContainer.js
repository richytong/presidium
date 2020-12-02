const rubico = require('rubico')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const Docker = require('./Docker')
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

/**
 * @name DockerContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerContainer(image string) -> DockerContainer
 * ```
 *
 * @TODO
 * Refactor all Docker functionality to Docker
 * Use og docker to implement APIs
 *
 * ```javascript
 * new DockerContainer('node:15-alpine', options? {
 *   name: string, // specific name for the container
 *   rm: boolean, // automatically remove the container when it exits TODO
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Array<string>, // '<hostPort>:<containerPort>[:"tcp"|"udp"|"sctp"]'
 *   healthcheck: {
 *     test: Array<string>, // healthcheck command configuration. See description
 *     interval?: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *     timeout?: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *     retries?: 5|number, // number of retries before unhealhty
 *     startPeriod?: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   },
 *   memory: number, // memory limit in bytes
 *   mounts: Array<{
 *     source: string, // name of volume
 *     target: string, // mounted path inside container
 *     readonly: boolean,
 *   }>|Array<string>, // '<source>:<target>[:readonly]'
 *
 *   // Dockerfile defaults
 *   cmd: Array<string|number>, // CMD
 *   expose: Array<(port string)>, // EXPOSE
 *   volume: Array<path string>, // VOLUME
 *   workdir: path string, // WORKDIR
 *   env: {
 *     HOME: string,
 *     HOSTNAME: string,
 *     PATH: string, // $PATH
 *     ...(moreEnvOptions Object<string>),
 *   }, // ENV; environment variables exposed to container during run time
 * }).run(['node', '-e', 'console.log(\'hey\')'])
 * ```
 *
 * @description
 * Declarative syntax for Docker containers.
 * ```javascript
 * new DockerContainer('node:15-alpine', {
 *   name: 'my-container',
 *   env: { FOO: 'hey', BAR: 1 },
 *   cmd: ['node', '-e', 'console.log(process.env.FOO)'],
 * }).attach(async dockerRawStream => {
 *   // main process stream
 * }).start()
 * ```
 */
const DockerContainer = function (image, options) {
  if (this == null || this.constructor != DockerContainer) {
    return new DockerContainer(image, options)
  }
  this.docker = new Docker()
  this.image = image
  this.options = options
  this.containerId = null
  this.promises = new Set()
  this.ready = this.docker.createContainer(image, {
    rm: true, ...options,
  }).then(pipe([
    response => response.json(),
    get('Id'),
    containerId => {
      this.containerId = containerId
    },
  ]))
  return this
}


// dockerContainer.run(cmd? Array<string>) -> mainCmdStream ReadableStream
DockerContainer.prototype.run = function dockerContainerRun(cmd) {
  if (this.containerId != null) {
    return this.exec(cmd ?? this.options.cmd)
  }
  const result = new stream.PassThrough(),
    promise = this.docker.createContainer(this.image, {
      ...this.options,
      ...cmd && { cmd },
    }).then(pipe([
      response => response.json(),
      get('Id'),
      async containerId => {
        const attachResponse = await this.docker.attachContainer(containerId)
        attachResponse.body.pipe(result)
        await this.docker.startContainer(containerId)
        this.promises.delete(promise)
        this.containerId = containerId
      },
    ]))
  this.promises.add(promise)
  let outputPromise = null
  result.then = (handler, onError) => {
    if (outputPromise == null) {
      outputPromise = passthrough('')(result)
    }
    return outputPromise.then(handler, onError)
  }
  return result
}

// dockerContainer.stop(cmd Array<string>) -> sideCmdStream ReadableStream
DockerContainer.prototype.stop = function dockerContainerStop() {
  return this.docker.stopContainer(this.containerId, { time: 1 })
    .then(always({ message: 'success' }))
}

// dockerContainer.exec(cmd Array<string>) -> sideCmdStream ReadableStream
DockerContainer.prototype.exec = function dockerContainerExec(cmd) {
  const result = new PassThroughStream(),
    promise = this.docker.execContainer(this.containerId, cmd)
      .then(response => {
        response.body.pipe(result)
        this.promises.delete(promise)
      })
  this.promises.add(promise)
  let outputPromise = null
  result.then = (handler, onError) => {
    if (outputPromise == null) {
      outputPromise = passthrough('')(result)
    }
    return outputPromise.then(handler, onError)
  }
  return result
}

module.exports = DockerContainer
