const rubico = require('rubico')
const isString = require('rubico/x/isString')
const identity = require('rubico/x/identity')
const querystring = require('querystring')
const stringifyJSON = require('./internal/stringifyJSON')
const split = require('./internal/split')
const join = require('./internal/join')
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
 * @name DockerContainer
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerContainer(image string) -> DockerContainer
 * ```
 */
const DockerContainer = function (image) {
  if (this == null || this.constructor != DockerContainer) {
    return new DockerContainer(image)
  }
  this.docker = new Docker()
  this.http = this.docker.http
  this.image = image
  return this
}

/**
 * @name DockerContainer.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerContainer(image string).create(options? {
 *   name: string, // specific name for the container
 *   restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *   cleanup: false|true, // remove the container's file system when the container exits
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

DockerContainer.prototype.create = function dockerContainerCreate(options = {}) {
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
      Image: this.image,

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

      ...options.healthcheck && {
        Healthcheck: fork({
          Test: get('test', () => {
            throw new Error('healthcheck.test parameter required')
          }),
          Interval: get('interval', 10e9),
          Timeout: get('timeout', 20e9),
          Retries: get('retries', 5),
          StartPeriod: get('startPeriod', 1e6),
        })(options.healthcheck),
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
      },
    }),

    headers: {
      'Content-Type': 'application/json',
    },
  })
}

/**
 * @name DockerContainer.prototype.run
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerContainer().run(cmd Array<string>) -> Promise<HttpResponse>
 * ```
 */

DockerContainer.prototype.run = async function dockerContainerRun(
  cmd, options = {}
) {
  return this.create({ ...options, cmd }).then(pipe([
    tap(async response => {
      if (!response.ok) {
        throw new Error(`${response.statusText}: ${await response.text()}`)
      }
    }),
    response => response.json(),
    get('Id'),
    async containerId => {
      const attachResponse = await this.docker.attach(containerId),
        startResponse = await this.docker.start(containerId)
      if (!startResponse.ok) {
        throw new Error(
          `${startResponse.statusText}: ${await startResponse.text()}`)
      }
      attachResponse.headers.set('x-presidium-container-id', containerId)
      return attachResponse
    },
  ]))
}

module.exports = DockerContainer
