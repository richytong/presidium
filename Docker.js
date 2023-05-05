const rubico = require('rubico')
const zlib = require('zlib')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const size = require('rubico/x/size')
const flatten = require('rubico/x/flatten')
const defaultsDeep = require('rubico/x/defaultsDeep')
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
const has = require('./internal/has')
const filterExists = require('./internal/filterExists')

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
 * Docker().auth(options {
 *   username: string,
 *   password: string,
 *   email: string,
 *   serveraddress: string, // domain/IP without a protocol
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.auth = function dockerAuth(options) {
  return this.http.post('auth', {
    headers: {
      'Content-Type': 'application/json',
    },
    body: pipe([
      pick(['username', 'password', 'email', 'serveraddress']),
      stringifyJSON,
      tap(console.log),
    ])(options),
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
 * @name Docker.prototype.pullImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().pullImage(
 *   name string,
 *   options {
 *     repo: string, // additional path prefix saved on this machine
 *     tag?: string, // if not in name
 *     message?: string, // commit message for image
 *     platform?: ''|'<os>[/arch[/variant]]'
 *     username: string,
 *     password: string,
 *     email?: string,
 *     serveraddress?: string,
 *     identitytoken?: string,
 *   },
 * )
 * ```
 */
Docker.prototype.pullImage = function dockerPullImage(name, options = {}) {
  return this.http.post(`/images/create?${querystring.stringify({
    fromImage: name,
    ...pick(['repo', 'tag', 'message', 'platform'])(options),
  })}`, {
    headers: {
      'X-Registry-Auth': pipe([
        pick([
          'username',
          'password',
          'email',
          'serveraddress',
          'identitytoken',
        ]),
        stringifyJSON,
        Buffer.from,
        buffer => buffer.toString('base64'),
      ])(options),
    },
  })
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
 *     ignore: Array<string>, // paths or names to ignore in build context tarball
 *     archive: Object<path string)=>(content string)>, // object representation of the base archive for build context
 *     archiveDockerfile: string, // path to Dockerfile in archive
 *     platform: string, // e.g. linux/x86_64
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * Build a Docker Image. `path` must be absolute
 * [Dockerfile docs](https://docs.docker.com/engine/reference/builder/)
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

Docker.prototype.buildImage = async function (image, path, options) {
  const archive = new Archive(options.archive)
  return this.http.post(`/build?${querystring.stringify({
    dockerfile: options.archiveDockerfile ?? 'Dockerfile',
    t: image,
    forcerm: true,
    platform: options.platform ?? '',
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
        'X-Registry-Auth': pipe([
          pick([
            'username',
            'password',
            'email',
            'serveraddress',
            'identitytoken',
          ]),
          stringifyJSON,
          Buffer.from,
          buffer => buffer.toString('base64'),
        ])(options),
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
 * new Docker().createContainer(name string, options? {
 *   image: string, // image to run in the container
 *   rm: boolean, // automatically remove the container when it exits
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
 *   cpus: number, // number of cpus
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
  options = {}
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
      Image: options.image,

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
 * Docker().initSwarm(address string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.initSwarm = async function dockerInitSwarm(address) {
  return this.http.post('/swarm/init', {
    headers: {
      'Content-Type': 'application/json',
    },
    body: stringifyJSON({
      AdvertiseAddr: address,
      ListenAddr: address,
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
 *     advertiseAddr: string, // <ip|interface>:<port> to advertise to other nodes
 *     listenAddr: '0.0.0.0:2377'|string, // listen for inbound swarm manager traffic on this address <ip|interface>:<port>
 *     dataPathAddr: string, // address or interface for data path traffic <ip|interface>; use to separate data traffic from management traffic
 *   },
 * ) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.joinSwarm = async function dockerJoinSwarm(
  address, token, options = {}
) {
  return this.http.post('/swarm/join', {
    body: stringifyJSON({
      JoinToken: token,
      AdvertiseAddr: get('advertiseAddr', address)(options),
      ListenAddr: get('listenAddr', '0.0.0.0:2377')(options),
      ...options.remoteAddrs && { RemoteAddrs: options.remoteAddrs },
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
Docker.prototype.leaveSwarm = function dockerLeaveSwarm(options) {
  return this.http.post(`/swarm/leave?${
    querystring.stringify(pick(['force'])(options))
  }`)
}

/**
 * @name Docker.prototype.updateSwarm
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().updateSwarm({
 *   version: number, // version number of swarm object being updated
 *   rotateWorkerToken: boolean, // whether to rotate worker token
 *   rotateManagerToken: boolean, // whether to rotate manager token
 *   rotateManagerUnlockKey: boolean, // whether to rotate unlock key
 *   taskHistoryLimit: 10|number, // number of tasks revisions to retain for rollbacks
 *   dispatcherHeartbeat: 5e9|number, // nanoseconds delay for agent to ping dispatcher
 *   autolock: false|true, // whether to lock managers when they stop
 *   certExpiry: 7776000000000000|number, // validity period in nanoseconds for node certs
 *   snapshotInterval: 10000|number, // number of log entries between raft snapshots
 *   keepOldSnapshots: 0|number, // number of snapshots to keep beyond current snapshot
 *   logEntriesForSlowFollowers: 500|number, // number of log entries to retain to sync up slow followers after snapshot creation
 *   electionTick: 10|number, // number of ticks a follower will wait before starting a new election. Must be greater than heartbeatTick
 *   heartbeatTick: 1|number, // number of ticks between heartbeats. One tick ~ one second
 * })
 * ```
 *
 * @description
 * https://docs.docker.com/engine/api/v1.40/#operation/SwarmUpdate
 */

Docker.prototype.updateSwarm = async function dockerUpdateSwarm(options = {}) {
  const raft = {
    ...options.snapshotInterval && {
      SnapshotInterval: options.snapshotInterval,
    },
    ...options.keepOldSnapshots && {
      KeepOldSnapshots: options.keepOldSnapshots,
    },
    ...options.logEntriesForSlowFollowers && {
      LogEntriesForSlowFollowers: options.logEntriesForSlowFollowers,
    },
    ...options.electionTick && {
      ElectionTick: options.electionTick,
    },
    ...options.heartbeatTick && {
      HeartbeatTick: options.heartbeatTick,
    },
  }

  return this.http.post(`/swarm/update?${
    querystring.stringify(pick([
      'version',
      'rotateWorkerToken',
      'rotateManagerToken',
      'rotateManagerUnlockKey',
    ])(options))
  }`, {
    headers: {
      'Content-Type': 'application/json',
    },

    body: stringifyJSON(defaultsDeep(get('spec', {})(options))({
      ...options.taskHistoryLimit && {
        Orchestration: {
          TaskHistoryRetentionLimit: options.taskHistoryLimit,
        },
      },
      ...options.dispatcherHeartbeat && {
        Dispatcher: {
          dispatcherHeartbeat: options.dispatcherHeartbeat,
        },
      },
      ...options.autolock && {
        EncryptionConfig: {
          AutoLockManagers: options.autolock,
        },
      },
      ...options.certExpiry && {
        CAConfig: {
          NodeCertExpiry: options.certExpiry,
        },
      },
      ...gt(size, 0)(raft) && { Raft: raft },
    })),
  })
}

/**
 * @name Docker.prototype.createService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().createService(service string, options {
 *   image: string,
 *   replicas: 1|number,
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
 *   // user-defined metadata
 *   labels: object,
 * }) -> Promise<HttpResponse>
 * ```
 */

Docker.prototype.createService = function dockerCreateService(service, options) {
  return this.http.post('/services/create', {
    body: stringifyJSON({
      Name: service,
      Labels: options.labels ?? {},
      TaskTemplate: {
        ContainerSpec: {
          Image: options.image,
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

        Resources: {
          Reservations: {
            ...options.memory ? {
              MemoryBytes: Number(options.memory),
            } : {},
            ...options.cpus ? {
              NanoCPUs: Number(options.cpus * 1e9),
            } : {},
          }, // bytes
        },

        ...options.logDriver && {
          LogDriver: {
            Name: options.logDriver,
            Options: { ...options.logDriverOptions },
          },
        },
      },

      Mode: options.replicas == 'global' ? {
        Global: {},
      } : {
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

      ...options.network && {
        Networks: [{
          Target: options.network,
          Aliases: [],
          DriverOpts: {},
        }],
      },

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
    headers: {
      'Content-Type': 'application/json',
      'X-Registry-Auth': pipe([
        pick([
          'username',
          'password',
          'email',
          'serveraddress',
          'identitytoken',
        ]),
        stringifyJSON,
        Buffer.from,
        buffer => buffer.toString('base64'),
      ])(options),
    },
  })
}

/**
 * property string => value any => boolean|any
const has = property => value => {
  if (value == null) {
    return false
  }
  if (typeof value.has == 'function') {
    return value.has(property)
  }
  return isObject(value) && property in value
} */

/**
 * @name Docker.prototype.updateService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().updateService(service string, options {
 *   version: number, // current version of service
 *   registryAuthFrom: 'spec'|'previous-spec', // where to look for auth if no authorization
 *   rollback: 'previous', // roll service back to previous version
 *   authorization: {
 *     username: string,
 *     password: string,
 *     email: string,
 *     serveraddress: string,
 *   }|{ identitytoken: string },
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
 *
 *   // auth options
 *   username: string,
 *   password: string,
 *   email?: string,
 *   serveraddress?: string,
 *   identitytoken?: string,
 *
 *   // user-defined metadata
 *   labels: object,
 * }) -> Promise<HttpResponse>
 * ```
 */

Docker.prototype.updateService = function dockerUpdateService(service, options) {
  return this.http.post(`/services/${service}/update?${
    querystring.stringify(pick([
      'version',
      'registryAuthFrom',
      'rollback',
    ])(options))
  }`, {

    body: stringifyJSON(defaultsDeep(get('spec', {})(options))({
      Name: service,
      Labels: options.labels ?? {},
      TaskTemplate: {
        ContainerSpec: {
          ...options.image && { Image: options.image },
          ...options.cmd && { Command: options.cmd },
          ...options.env && {
            Env: Object.entries(options.env)
              .map(([key, value]) => `${key}=${value}`),
          },
          ...options.workdir && { Dir: options.workdir },

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
            ])),
          },

          ...or([
            has('healthCmd'),
            has('healthInterval'),
            has('healthTimeout'),
            has('healthRetries'),
            has('healthStartPeriod'),
          ])(options) && {
            HealthCheck: {
              ...options.healthCmd && { Test: ['CMD', ...options.healthCmd] },
              ...options.healthInterval && { Interval: options.healthInterval },
              ...options.healthTimeout && { Timeout: options.healthTimeout },
              ...options.healthRetries && { Retries: options.healthRetries },
              ...options.healthStartPeriod && { StartPeriod: options.healthStartPeriod },
            },
          },
        },

        ...or([has('restart'), has('restartDelay')])(options) && {
          RestartPolicy: {
            ...options.restart && fork({
              Condition: get(0),
              MaxAttempts: pipe([get(1, 0), Number]),
            })(options.restart.split(':')),
            ...options.restartDelay && { Delay: Number(options.restartDelay) },
          },
        },
        Resources: {
          Reservations: {
            ...options.memory ? {
              MemoryBytes: Number(options.memory),
            } : {},
            ...options.cpus ? {
              NanoCPUs: Number(options.cpus * 1e9),
            } : {},
          }, // bytes
        },
        ...or([has('logDriver'), has('logDriverOptions')])(options) && {
          LogDriver: {
            ...options.logDriver && { Name: options.logDriver },
            ...options.logDriverOptions && { Options: options.logDriverOptions },
          },
        },
      },

      ...options.replicas && {
        Mode: {
          Replicated: { Replicas: Number(options.replicas) },
        },
      },

      ...or([
        has('updateParallelism'),
        has('updateDelay'),
        has('updateFailureAction'),
        has('updateMonitor'),
        has('updateMaxFailureRatio'),
      ])(options) && {
        UpdateConfig: {
          ...options.updateParallelism && { Parallelism: options.updateParallelism },
          ...options.updateDelay && { Delay: options.updateDelay }, // ns
          ...options.updateFailureAction && { FailureAction: options.updateFailureAction },
          ...options.updateMonitor && { Monitor: options.updateMonitor }, // ns
          ...options.updateMaxFailureRatio && { MaxFailureRatio: options.updateMaxFailureRatio },
        },
      },

      ...or([
        has('rollbackParallelism'),
        has('rollbackDelay'),
        has('rollbackFailureAction'),
        has('rollbackMonitor'),
        has('rollbackMaxFailureRatio'),
      ])(options) && {
        RollbackConfig: {
          ...options.rollbackParallelism && { Parallelism: options.rollbackParallelism },
          ...options.rollbackDelay && { Delay: options.rollbackDelay },
          ...options.rollbackFailureAction && { FailureAction: options.rollbackFailureAction },
          ...options.rollbackMonitor && { Monitor: options.rollbackMonitor },
          ...options.rollbackMaxFailureRatio && { MaxFailureRatio: options.rollbackMaxFailureRatio },
        },
      },

      ...options.network && {
        Networks: [{
          Target: options.network,
          Aliases: [],
          DriverOpts: {},
        }],
      },

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
    })),
    headers: {
      'Content-Type': 'application/json',
      'X-Registry-Auth': pipe([
        pick([
          'username',
          'password',
          'email',
          'serveraddress',
          'identitytoken',
        ]),
        stringifyJSON,
        Buffer.from,
        buffer => buffer.toString('base64'),
      ])(options),
    },
  })
}

/**
 * @name Docker.prototype.deleteService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().deleteService(id string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.deleteService = function deleteService(id) {
  return this.http.delete(`/services/${id}`)
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
 * @name Docker.prototype.getServiceLogs
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().getServiceLogs(serviceId string, options {
 *   stdout: boolean, // return logs from stdout, default false
 *   stderr: boolean, // return logs from stderr, default false
 *   follow: boolean, // keep connection after returning logs, default false
 *   since: number, // unix timestamp, 1612543950742
 *   timestamps: boolean, // add timestamps to every log line
 *   tail: 'all'|number, // only return this number of log lines from the end of logs.
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.getServiceLogs = async function getServiceLogs(serviceId, options) {
  return this.http.get(`/services/${serviceId}/logs?${
    querystring.stringify(pick([
      'stdout', 'stderr', 'follow',
      'since', 'timestamps', 'tail',
    ])(options))
  }`)
}

/**
 * @name Docker.prototype.listTasks
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().listTasks(options {
 *   service?: string,
 *   node?: string,
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.listTasks = async function listTasks(options) {
  return this.http.get(`/tasks?${
    querystring.stringify(pick(['service', 'node'])(options))
  }`)
}

/**
 * @name Docker.prototype.listNodes
 *
 * @synopsis
 * ```coffeescript [specscript]
 * Docker().listNodes() -> Promise<HttpResponse>
 * ```
 *
 * @description
 * See https://docs.docker.com/engine/api/v1.40/#operation/NodeList
 */
Docker.prototype.listNodes = async function listNodes() {
  return this.http.get('/nodes')
}

/**
 * @name Docker.prototype.deleteNode
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().deleteNode(id string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.deleteNode = function deleteNode(id) {
  return this.http.delete(`/nodes/${id}`)
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
 * @name Docker.prototype.createNetwork
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().createNetwork(options {
 *   name: string, // name of the network
 *   driver?: 'bridge'|'host'|'overlay'|'ipvlan'|'macvlan', // default 'bridge'
 *   ingress?: boolean,
 *   subnet?: string, // e.g. '10.0.0.0/20'
 *   gateway?: string, // e.g. '10.0.0.1'
 * }) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.createNetwork = function createNetwork(options) {
  return this.http.post('/networks/create', {
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(filterExists({
      Name: options.name,
      Driver: options.driver,
      Ingress: options.ingress,
      CheckDuplicate: true,
      ...options.subnet == null && options.gateway == null ? {} : {
        IPAM: {
          Driver: 'default',
          Config: [filterExists({
            Subnet: options.subnet,
            Gateway: options.gateway,
          })],
          Options: {},
        },
      },
    })),
  })
}

/**
 * @name Docker.prototype.inspectNetwork
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().inspectNetwork(id string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.inspectNetwork = function inspectNetwork(id) {
  return this.http.get(`/networks/${id}`)
}

/**
 * @name Docker.prototype.deleteNetwork
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new Docker().deleteNetwork(id string) -> Promise<HttpResponse>
 * ```
 */
Docker.prototype.deleteNetwork = function deleteNetwork(id) {
  return this.http.delete(`/networks/${id}`)
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
