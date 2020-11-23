const rubico = require('rubico')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const flatten = require('rubico/x/flatten')
const trace = require('rubico/x/trace')
const Http = require('./Http')
const HttpAgent = require('./HttpAgent')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const toString = require('./internal/toString')
const isArray = require('./internal/isArray')

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
 * @name Docker
 *
 * @synopsis
 * new Docker() -> Docker
 */
const Docker = function () {
  if (this == null || this.constructor != Docker) {
    return new Docker()
  }
  const agent = new HttpAgent({
    socketPath: '/var/run/docker.sock',
  })
  this.http = new Http('http://0.0.0.0/v1.40', { agent })
  return this
}

/**
 * @name Docker.prototype.auth
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().auth({
 *   username: string,
 *   password: string,
 *   email: string,
 *   serveraddress: string, // domain/IP without a protocol
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.auth = function dockerAuth(authorization) {
  return this.http.post('auth', {
    body: switchCase([
      isString,
      identity,
      pipe([
        pick(['username', 'password', 'email', 'serveraddress']),
        stringifyJSON,
      ]),
    ])(authorization)
  })
}

/**
 * @name Docker.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker.Volume = {
 *   Source: string, // volume name or host path
 *   Target: string, // path in container
 *   Type: 'volume',
 *   ReadOnly: boolean,
 *   Consistency: 'default'|'consistent'|'cached'|'delegated',
 *   NoCopy: boolean, // populate volume with data from target (false)
 *   Labels: Object<string>, // user defined metadata
 *   DriverConfig: Object<(drivername string)=>(driverconfig Object)>, // drivers to use to create the volume
 * }
 *
 * new Docker().create(
 *   image string,
 *   options? {
 *     name: string, // specific name for the container
 *     restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *     cleanup: false|true, // remove the container's file system when the container exits
 *     logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *     portBindings: Object<(containerPort string)=>(hostports Array<string>)> // <port>[/<protocol 'tcp'|'udp'>]
 *     publish: Object<(hostPort string)=>(containerPort string)>,
 *     healthcheck: {
 *       test: Array<string>, // healthcheck command configuration. See description
 *       interval: 0|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *       timeout: 0|>1e6, // nanoseconds to wait before healthcheck fails
 *       retries: number, // number of retries before unhealhty
 *       startPeriod: 0|>1e6, // nanoseconds to wait on container init before starting first healthcheck
 *     },
 *     mounts: Array<Docker.Volume>,
 *     memory: number, // memory limit in bytes
 *
 *     // Dockerfile defaults
 *     cmd: Array<string|number>, // CMD
 *     expose: Array<(port string)>, // EXPOSE
 *     volume: Array<path string>, // VOLUME
 *     workdir: path string, // WORKDIR
 *     env: {
 *       HOME: string,
 *       HOSTNAME: string,
 *       PATH: string, // $PATH
 *       ...(moreEnvOptions Object<string>),
 *     }, // ENV; environment variables exposed to container during run time
 *   },
 * )
 *
 * @description
 * https://docs.docker.com/engine/reference/commandline/create/
 *
 * Restart policies:
 *   * `no` - do not restart the container when it exits
 *   * `on-failure` - restart only if container exits with non-zero exit code
 *   * `always` - always restart container regardless of exit code
 *   * `unless-stopped` - like `always` except if the container was put into a stopped state before the Docker daemon was stopped
 *
 * Health checks:
 *   * `[]` - inherit healthcheck from image or parent image
 *   * `['NONE']` - disable healthcheck
 *   * `['CMD', ...args]` - exec arguments directly
 *   * `['CMD-SHELL', command string]` - run command with system's default shell
 * ```
 */

Docker.prototype.create = function dockerCreate(image, options) {
  return this.http.post(`/containers/create?${
    querystring.stringify({
      ...options.name && { name: options.name },
    })
  }`, {
    body: stringifyJSON({
      AttachStderr: true,
      AttachStdout: true,
      AttachStdin: false,
      Tty: false,
      Image: image,

      ...options.cmd && { Cmd: options.cmd },
      ...options.env && {
        Env: Object.entries(options.env)
          .map(([key, value]) => `${key}=${value}`),
      },
      ...options.expose && {
        ExposedPorts: transform(map(pipe([
          toString,
          split('/'),
          fork([get(0), get(1, 'tcp')]),
          join('/'),
          port => ({ [port]: {} }),
        ])), {})(options.expose),
      },
      ...options.workdir && {
        WorkingDir: options.workdir,
      },
      ...options.volume && {
        Volumes: transform(map(path => ({ [path]: {} })), {})(options.volume),
      },
      ...options.healthcheck && {
        Healthcheck: fork({
          Test: get('test', () => {
            throw new Error('healthcheck.test parameter required')
          }),
          Interval: get('interval', 0),
          Timeout: get('timeout', 0),
          Retries: get('retries', 0),
          StartPeriod: get('startPeriod', 0),
        })(options.healthcheck),
      },

      HostConfig: {
        ...options.memory && { Memory: options.memory },
        ...options.publish && {
          PortBindings: map.entries(fork([ // publish and PortBindings are reversed
            pipe([ // container port
              get(1),
              toString,
              split('/'),
              fork([get(0), get(1, 'tcp')]),
              join('/'),
            ]),
            pipe([ // host port
              get(0),
              toString,
              HostPort => [{ HostPort }],
            ]),
          ]))(options.publish),
        },
        ...options.logDriver && {
          LogConfig: {
            Type: options.logDriver,
            Config: { ...options.logDriverOptions },
          },
        },
        ...options.restart && {
          RestartPolicy: fork({
            Name: get(0, ''),
            MaximumRetryCount: get(1, 0),
          })(options.restart.split(':')),
        },
      },
    }),

    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * @name Docker.prototype.attach
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().attach(containerId string, options? {
 *   stdout: boolean,
 *   stderr: boolean,
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.attach = function dockerAttach(containerId, options = {}) {
  return this.http.post(`/containers/${containerId}/attach?${
    querystring.stringify({
      stream: 1,
      stdout: options.stdout ?? 1,
      stderr: options.stderr ?? 1,
    })
  }`)
}

/**
 * @name Docker.prototype.start
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().start(containerId string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.start = function dockerStart(containerId) {
  return this.http.post(`/containers/${containerId}/start`)
}

/**
 * @name Docker.prototype.stop
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().stop(containerId string, options? {
 *   time: number, // seconds before killing container
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.stop = function dockerStop(containerId, options = {}) {
  return this.http.post(`/containers/${containerId}/stop?${
    querystring.stringify({
      ...options.time && { t: options.time },
    })
  }`)
}

/**
 * @name Docker.prototype.inspect
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().inspect(containerId string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspect = function dockerInspect(containerId) {
  return this.http.get(`/containers/${containerId}/json`)
}

/**
 * @name Docker.prototype.listImages
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().listImages() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.listImages = function dockerListImages() {
  return this.http.get('/images/json')
}

/**
 * @name Docker.prototype.inspectImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().inspectImage(image string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectImage = function dockerInspectImage(image) {
  return this.http.get(`/images/${image}/json`)
}

/**
 * @name Docker.prototype.tagImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().tagImage(
 *   name string,
 *   options {
 *     repo: string, // some_user/some_image
 *     tag: string,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.tagImage = function dockerTagImage(name, options) {
  return this.http.post(`/images/${name}/tag?${
    querystring.stringify(pick(['repo', 'tag'])(options))
  }`)
}

/**
 * @name Docker.prototype.removeImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().removeImage(image string, options? {
 *   force: boolean,
 *   noprune: boolean, // do not delete untagged parent images
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * `image` is a docker image name or ID
 */
Docker.prototype.removeImage = function dockerRemoveImage(image, options) {
  return this.http.delete(`/images/${image}?${
    querystring.stringify(pick(['force', 'noprune'])(options))
  }`)
}

/**
 * @name Docker.prototype.inspectSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker(address).inspectSwarm() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectSwarm = function dockerInspectSwarm() {
  return this.http.get('/swarm')
}

/**
 * @name Docker.prototype.initSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().initSwarm(address string, options? {
 *   ListenAddr: string, // Listen address for inter-manager communication <address|interface>:<port>
 *   DataPathAddr: string, // address or interface for data traffic
 *   DataPathPort: 4789|number, // port number for data traffic
 *   DefaultAddrPool: Array<string>, // specify default subnet pools for global scope networks
 *   ForceNewCluster: boolean, // force create new swarm
 *   SubnetSize: number, // subnet size of networks created from default subnet pool
 *   Spec: SwarmSpec,
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.initSwarm = async function dockerInitSwarm(address, options) {
  return this.http.post('/swarm/init', {
    body: stringifyJSON({
      AdvertiseAddr: address,
      ListenAddr: address,
      ...options,
    }),
  })
}

/**
 * @name Docker.prototype.joinSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().joinSwarm(
 *   address string,
 *   token string,
 *   options? {
 *     remoteAddrs: Array<string>, // addresses of manager nodes already participating in the swarm
 *     listenAddr: '0.0.0.0:2377'|string, // listen for inbound swarm manager traffic on this address <ip|interface>:<port>
 *     dataPathAddr: string, // address or interface for data path traffic <ip|interface>; use to separate data traffic from management traffic
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.joinSwarm = async function dockerJoinSwarm(
  address, token, options = {}
) {
  const port = options.address ? options.address.split(':')[1] : '2377'
  return this.http.post('/swarm/join', {
    body: stringifyJSON({
      AdvertiseAddr: address,
      ListenAddr: options.listenAddr ?? `0.0.0.0:${port}`,
      JoinToken: token,
      ...options.remoteAddrs && { RemoteAddrs: options.remoteAddrs },
      ...options.listenAddr && { ListenAddr: options.listenAddr },
      ...options.dataPathAddr && { DataPathAddr: options.dataPathAddr },
    }),
  })
}

/**
 * @name Docker.prototype.leaveSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().leaveSwarm(options? { force: boolean }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.leaveSwarm = async function dockerLeaveSwarm(options = {}) {
  return this.http.post(`/swarm/leave?${
    querystring.stringify({ force: options.force ?? false })}
  `)
}

module.exports = Docker
