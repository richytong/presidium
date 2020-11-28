const rubico = require('rubico')
const zlib = require('zlib')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const flatten = require('rubico/x/flatten')
const trace = require('rubico/x/trace')
const Http = require('./Http')
const HttpAgent = require('./HttpAgent')
const Archive = require('./Archive')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
const isArray = require('./internal/isArray')
const pathJoin = require('./internal/pathJoin')

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
 * @name Docker.prototype.listContainers
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().listContainers() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.listContainers = function dockerListContainers() {
  return this.http.get('/containers/json')
}

/**
 * @name Docker.prototype.buildImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().buildImage(
 *   image string,
 *   path string,
 *   options? {
 *     ignore: Array<string>, // paths or names to ignore in tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *     archiveDockerfile: string, // path to Dockerfile in archive
 *   },
 * ) -> ()
 * ```
 *
 * @description
 * Build a Docker Image. `path` must be absolute
 *
 * ```javascript
 * Docker().buildImage('my-image', path string, {
 *   archive: {
 *     Dockerfile: `
 * FROM node:15-alpine
 * RUN apk add openssh neovim
 * EXPOSE 8080`,
 *   },
 *   ignore: ['Dockerfile'],
 * })
 *
 * Dockerfile Syntax
 * ```sh
 * HEALTHCHECK \
 *   [--interval=<duration '30s'|string>] \
 *   [--timeout=<duration '30s'|string>] \
 *   [--start-period=<duration '0s'|string>] \
 *   [--retries=<3|number>] \
 * CMD <string>
 *
 * ENV <key>=<value> ...<key>=<value>
 *
 * EXPOSE <port> [...<port>/<protocol 'tcp'|'udp'>]
 *
 * WORKDIR <path>
 *
 * VOLUME ["<path>", ..."<paths>"]|<paths string>
 *
 * USER <user>[:<group>]|<UID>[:<GID>]
 *
 * ENTRYPOINT ["<executable>", ..."<parameter>"]
 *   |"<command> ...<parameter>"
 *
 * CMD ["<executable>", ..."<parameter>"] # exec form
 *   |[..."<parameter>"] # default parameters to ENTRYPOINT
 *   |"<command> ...<parameter>" # shell form
 * ```
 */

Docker.prototype.buildImage = async function (image, path, options = {}) {
  const archive = new Archive(options?.archive)
  return this.http.post(`/build?${querystring.stringify({
    dockerfile: options.archiveDockerfile ?? 'Dockerfile',
    t: image,
    forcerm: true,
  })}`, {
    body: archive.tar(path, {
      ignore: options.ignore ?? ['node_modules', '.git', '.nyc_output'],
    }).pipe(zlib.createGzip()),
    headers: {
      'Content-Type': 'application/x-tar',
    },
  })
}

/**
 * @name Docker.prototype.pushImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pushImage(image string, repository string, options {
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{
 *     identitytoken: string,
 *   },
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * https://docs.docker.com/registry/deploying/
 */
Docker.prototype.pushImage = function (image, repository, options = {}) {
  return pipe([
    fork({
      imagename: pipe([
        name => name.split(':')[0],
        curry.arity(2, pathJoin, repository, __),
      ]),
      search: name => querystring.stringify({ tag: name.split(':')[1] }),
    }),
    ({
      imagename, search,
    }) => this.http.post(`/images/${imagename}/push?${search}`, {
      headers: {
        'X-Registry-Auth': stringifyJSON(
          options.authorization ?? { identitytoken: '' }),
      },
    }),
  ])(image)
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
 *   image string,
 *   options {
 *     repo: string, // some_user/some_image
 *     tag: string,
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.tagImage = function dockerTagImage(image, options) {
  return this.http.post(`/images/${image}/tag?${
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
 * @name Docker.prototype.createContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().createContainer(image string, options? {
 *   name: string, // specific name for the container
 *   rm: boolean, // automatically remove the container when it exits TODO
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Array<string>, // '<hostPort>:<containerPort>[:"tcp"|"udp"|"sctp"]'
 *   healthCmd: Array<string>, // healthcheck command. See description
 *   healthInterval: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *   healthTimeout: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *   healthRetries: 5|number, // number of retries before unhealhty
 *   healthStartPeriod: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
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
 * })
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

Docker.prototype.createContainer = function dockerCreateContainer(
  image, options = {}
) {
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
          String,
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

      ...options.healthCmd && {
        Healthcheck: { // note: this is correct versus the healthCmd in createService, which is HealthCheck
          Test: ['CMD', ...options.healthCmd],
          ...fork({
            Interval: get('healthInterval', 10e9),
            Timeout: get('healthTimeout', 20e9),
            Retries: get('healthRetries', 5),
            StartPeriod: get('healthStartPeriod', 1e6),
          })(options),
        },
      },

      HostConfig: {
        ...options.mounts && {
          Mounts: options.mounts.map(pipe([
            switchCase([
              isString,
              pipe([
                split(':'),
                fork({ target: get(0), source: get(1), readonly: get(2) }),
              ]),
              identity,
            ]),
            fork({
              Target: get('target'),
              Source: get('source'),
              Type: get('type', 'volume'),
              ReadOnly: get('readonly', false),
            }),
          ]))
        },

        ...options.memory && { Memory: options.memory },
        ...options.publish && {
          PortBindings: map.entries(fork([ // publish and PortBindings are reversed
            pipe([ // container port
              get(1),
              String,
              split('/'),
              fork([get(0), get(1, 'tcp')]),
              join('/'),
            ]),
            pipe([ // host port
              get(0),
              String,
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
            Name: get(0, 'no'),
            MaximumRetryCount: pipe([get(1, 0), Number]),
          })(options.restart.split(':')),
        },
        ...options.rm && { AutoRemove: options.rm },
      },
    }),

    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * @name Docker.prototype.attachContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().attachContainer(containerId string, options? {
 *   stdout: boolean,
 *   stderr: boolean,
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.attachContainer = function dockerAttachContainer(
  containerId, options = {}
) {
  return this.http.post(`/containers/${containerId}/attach?${
    querystring.stringify({
      stream: 1,
      stdout: options.stdout ?? 1,
      stderr: options.stderr ?? 1,
    })
  }`)
}

/**
 * @name Docker.prototype.execContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().execContainer(containerId string, cmd Array<string>) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.execContainer = function dockerExecContainer(
  containerId, cmd,
) {
  return this.http.post(`/containers/${containerId}/exec`, {
    body: stringifyJSON({
      AttachStdin: false,
      AttachStdout: true,
      AttachStderr: true,
      Tty: false,
      Cmd: cmd,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(pipe([
    tap(async response => {
      if (!response.ok) {
        throw new Error(`${response.statusText}: ${await response.text()}`)
      }
    }),
    response => response.json(),
    get('Id'),
    execId => this.http.post(`/exec/${execId}/start`, {
      body: stringifyJSON({ Detach: false, Tty: false }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
  ]))
}

/**
 * @name Docker.prototype.startContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().startContainer(containerId string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.startContainer = function dockerStartContainer(
  containerId,
) {
  return this.http.post(`/containers/${containerId}/start`)
}

/**
 * @name Docker.prototype.stopContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().stopContainer(containerId string, options? {
 *   time: number, // seconds before killing container
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.stopContainer = function dockerStopContainer(
  containerId, options = {}
) {
  return this.http.post(`/containers/${containerId}/stop?${
    querystring.stringify({
      ...options.time && { t: options.time },
    })
  }`)
}

/**
 * @name Docker.prototype.inspectContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().inspectContainer(containerId string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectContainer = function dockerInspectContainer(
  containerId,
) {
  return this.http.get(`/containers/${containerId}/json`)
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

/**
 * @name Docker.prototype.createService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().createService(image string, address string{
 *   replicas: 1|number,
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   restartDelay: 10e9|number, // nanoseconds to delay between restarts
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Object<(hostPort string)=>(containerPort string)>,
 *   healthcheck: {
 *     test: Array<string>, // healthcheck command configuration. See description
 *     interval?: 10e9|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *     timeout?: 20e9|>1e6, // nanoseconds to wait before healthcheck fails
 *     retries?: 5|number, // number of retries before unhealhty
 *     startPeriod?: >=1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   },
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
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * ```javascript
 * Docker(image, address).createService({
 *   replicas: 1,
 * })
 * ```
 */

Docker.prototype.createService = function dockerCreateService(image, options) {
  return this.http.post('/services/create', {
    body: stringifyJSON({
      ...options.name && { Name: options.name },
      TaskTemplate: {
        ContainerSpec: {
          Image: image,
          ...options.cmd && { Command: options.cmd },
          ...options.env && {
            Env: Object.entries(options.env)
              .map(([key, value]) => `${key}=${value}`),
          },
          ...options.workdir && {
            Dir: options.workdir,
          },

          ...options.mounts && {
            Mounts: options.mounts.map(pipe([
              switchCase([
                isString,
                pipe([
                  split(':'),
                  fork({ target: get(0), source: get(1), readonly: get(2) }),
                ]),
                identity,
              ]),
              fork({
                Target: get('target'),
                Source: get('source'),
                Type: get('type', 'volume'),
                ReadOnly: get('readonly', false),
              }),
            ]))
          },

          ...options.healthCmd && {
            HealthCheck: {
              Test: ['CMD', ...options.healthCmd],
              ...fork({
                Interval: get('healthInterval', 10e9),
                Timeout: get('healthTimeout', 20e9),
                Retries: get('healthRetries', 5),
                StartPeriod: get('healthStartPeriod', 1e6),
              })(options),
            },
          },
        },

        ...options.restart && {
          RestartPolicy: fork({
            Delay: always(options.restartDelay ?? 10e9),
            Condition: get(0, 'on-failure'),
            MaxAttempts: pipe([get(1, 10), Number]),
          })(options.restart.split(':')),
        },
        ...options.memory && {
          Resources: {
            Limits: { MemoryBytes: Number(options.memory) }, // bytes
          },
        },
        ...options.logDriver && {
          LogDriver: {
            Name: options.logDriver,
            Options: { ...options.logDriverOptions },
          },
        },
      },

      Mode: {
        Replicated: { Replicas: options.replicas ?? 1 }
      },
      UpdateConfig: fork({
        Parallelism: get('updateParallelism', 2),
        Delay: get('updateDelay', 1e9),
        FailureAction: get('updateFailureAction', 'pause'),
        Monitor: get('updateMonitor', 15e9),
        MaxFailureRatio: get('updateMaxFailureRatio', 0.15),
      })(options),
      RollbackConfig: fork({
        Parallelism: get('rollbackParallelism', 1),
        Delay: get('rollbackDelay', 1e9),
        FailureAction: get('rollbackFailureAction', 'pause'),
        Monitor: get('rollbackMonitor', 15e9),
        MaxFailureRatio: get('rollbackMaxFailureRatio', 0.15),
      })(options),

      ...options.publish && {
        EndpointSpec: {
          Ports: Object.entries(options.publish).map(pipe([
            map(String),
            fork({
              Protocol: ([hostPort, containerPort]) => {
                const hostProtocol = hostPort.split('/')[1],
                  containerProtocol = containerPort.split('/')[1]
                return hostProtocol ?? containerProtocol ?? 'tcp'
              },
              TargetPort: pipe([get(1), split('/'), get(0), Number]),
              PublishedPort: pipe([get(0), split('/'), get(0), Number]),
              PublishMode: always('ingress'),
            }),
          ])),
        },
      },
    }),
  })
}

/**
 * @name Docker.prototype.listServices
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().listServices(options? { filters: string })
 * ```
 *
 * @description
 * See https://docs.docker.com/engine/api/v1.40/#operation/ServiceList
 */
Docker.prototype.listServices = async function dockerListServices(options) {
  return this.http.get(`/services?${
    querystring.stringify(pick(['filters'])(options))
  }`)
}

/**
 * @name Docker.prototype.inspectService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().inspectService(serviceId string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectService = async function dockerInspectService(serviceId) {
  return this.http.get(`/services/${serviceId}`)
}

/**
 * @name Docker.prototype.pruneImages
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pruneImages() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.pruneImages = function dockerPruneImages() {
  return this.http.post('/images/prune')
}

/**
 * @name Docker.prototype.pruneContainers
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pruneContainers() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.pruneContainers = function dockerPruneContainers() {
  return this.http.post('/containers/prune')
}

/**
 * @name Docker.prototype.pruneVolumes
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pruneVolumes() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.pruneVolumes = function dockerPruneVolumes() {
  return this.http.post('/volumes/prune')
}

/**
 * @name Docker.prototype.pruneNetworks
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pruneNetworks() -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.pruneNetworks = function dockerPruneNetworks() {
  return this.http.post('/networks/prune')
}

// Docker.RawStreamHeader = function (buffer) {}

module.exports = Docker
