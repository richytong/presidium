const rubico = require('rubico')
const identity = require('rubico/x/identity')
const Archive = require('./Archive')
const Docker = require('./Docker')
const querystring = require('querystring')
const zlib = require('zlib')
const { exec } = require('child_process')
const pathJoin = require('./internal/pathJoin')
const isArray = require('./internal/isArray')
const stringifyJSON = require('./internal/stringifyJSON')
const startsWith = require('./internal/startsWith')
const split = require('./internal/split')
const join = require('./internal/join')
const toString = require('./internal/toString')

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
 * @name DockerImage
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerImage(name string) -> DockerImage
 * ```
 *
 * @description
 * Encapsulates `docker build` and `docker push`
 *
 * ```javascript
 * new DockerImage('my-app:latest')
 * ```
 */
const DockerImage = function (name) {
  if (this == null || this.constructor != DockerImage) {
    return new DockerImage(name)
  }
  this.name = name
  this.docker = new Docker()
  this.http = this.docker.http
  return this
}

/**
 * @name DockerImage.prototype.build
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name).build(
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
 * DockerImage(name).build(path string, {
 *   archive: {
 *     Dockerfile: `
 * FROM node:15-alpine
 * RUN apk add openssh neovim
 * EXPOSE 8888`,
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
DockerImage.prototype.build = async function (path, options = {}) {
  const archive = new Archive(options?.archive)
  return this.http.post(`/build?${querystring.stringify({
    dockerfile: options.archiveDockerfile ?? 'Dockerfile',
    t: this.name,
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
 * @name DockerImage.prototype.push
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerImage(name).push(repository string, options {
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
DockerImage.prototype.push = function (repository, options = {}) {
  return pipe([
    fork({
      image: pipe([
        name => name.split(':')[0],
        curry.arity(2, pathJoin, repository, __),
      ]),
      search: name => querystring.stringify({ tag: name.split(':')[1] }),
    }),
    ({
      image, search,
    }) => this.http.post(`/images/${image}/push?${search}`, {
      headers: {
        'X-Registry-Auth': stringifyJSON(
          options.authorization ?? { identitytoken: '' }),
      },
    }),
  ])(this.name)
}

/**
 * @name DockerImage.prototype.run
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
 * DockerImage(name).run(
 *   args Array<string|number>,
 *   options? {
 *     name: string, // specific name for the container
 *     restart: 'no'|'on-failure[:<max-retries>]'|'always'|'unless-stopped',
 *     cleanup: false|true, // remove the container's file system when the container exits
 *     logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *     portBindings: Object<(containerPort string)=>(hostports Array<string>)> // <port>[/<protocol 'tcp'|'udp'>]
 *     links: Array<(links string)>, // <containername>:<alias>
 *     healthcheck: []|['NONE']|['CMD', ...args]|['CMD-SHELL', command string]
 *     healthcheckInterval: 0|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *     healthcheckTimeout: 0|>1e6, // nanoseconds to wait before healthcheck fails
 *     healthcheckRetries: number, // number of retries before unhealhty
 *     healthcheckStartPeriod: 0|>1e6, // nanoseconds to wait on container init before starting first healthcheck
 *     mounts: Array<Docker.Volume>,
 *     memory: number, // memory limit in bytes
 *
 *     // Dockerfile defaults
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
 * https://docs.docker.com/engine/reference/run/
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

DockerImage.prototype.run = function (args, options = {}) {
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
      Image: this.name,
      Cmd: args,

      ...options.env && {
        Env: Object.entries(options.env).map(([key, value]) => `${key}=${value}`),
      },
      ...options.expose && {
        ExposedPorts: options.expose.map(pipe([
          toString,
          split('/'),
          fork([get(0), get(1, 'tcp')]),
          join('/'),
          port => ({ [port]: {} }),
        ]))
      },
      ...options.workdir && {
        WorkingDir: options.workdir,
      },
      ...options.volume && {
        Volumes: options.volume.map(path => ({ [path]: {} })),
      },
      ...options.healthcheck && {
        Healthcheck: {
          Test: options.healthcheck,
          Interval: options.healthcheckInterval ?? 0,
          Timeout: options.healthcheckTimeout ?? 0,
          Retries: options.healthcheckRetries ?? 0,
          StartPeriod: options.healthcheckStartPeriod ?? 0,
        },
      },

      HostConfig: {
        ...options.links && { Links: options.links },
        ...options.memory && { Memory: options.memory },
        ...options.portBindings && {
          PortBindings: map(fork({ HostPort: identity }))(options.portBindings),
        },
        ...options.logDriver && {
          LogConfig: { Type: options.logDriver, Config: {} },
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

/* {
  "Hostname": "",
  "Domainname": "",
  "User": "",
  "AttachStdin": false,
  "AttachStdout": true,
  "AttachStderr": true,
  "Tty": false,
  "OpenStdin": false,
  "StdinOnce": false,
  "Env": [
    "FOO=bar",
    "BAZ=quux"
  ],
  "Cmd": [
    "date"
  ],
  "Entrypoint": "",
  "Image": "ubuntu",
  "Labels": {
    "com.example.vendor": "Acme",
    "com.example.license": "GPL",
    "com.example.version": "1.0"
  },
  "Volumes": {
    "/volumes/data": {}
  },
  "WorkingDir": "",
  "NetworkDisabled": false,
  "MacAddress": "12:34:56:78:9a:bc",
  "ExposedPorts": {
    "22/tcp": {}
  },
  "StopSignal": "SIGTERM",
  "StopTimeout": 10,
  "HostConfig": {
    "Binds": [
      "/tmp:/tmp"
    ],
    "Links": [
      "redis3:redis"
    ],
    "Memory": 0,
    "MemorySwap": 0,
    "MemoryReservation": 0,
    "KernelMemory": 0,
    "NanoCPUs": 500000,
    "CpuPercent": 80,
    "CpuShares": 512,
    "CpuPeriod": 100000,
    "CpuRealtimePeriod": 1000000,
    "CpuRealtimeRuntime": 10000,
    "CpuQuota": 50000,
    "CpusetCpus": "0,1",
    "CpusetMems": "0,1",
    "MaximumIOps": 0,
    "MaximumIOBps": 0,
    "BlkioWeight": 300,
    "BlkioWeightDevice": [
      {}
    ],
    "BlkioDeviceReadBps": [
      {}
    ],
    "BlkioDeviceReadIOps": [
      {}
    ],
    "BlkioDeviceWriteBps": [
      {}
    ],
    "BlkioDeviceWriteIOps": [
      {}
    ],
    "DeviceRequests": [
      {
        "Driver": "nvidia",
        "Count": -1,
        "DeviceIDs\"": [
          "0",
          "1",
          "GPU-fef8089b-4820-abfc-e83e-94318197576e"
        ],
        "Capabilities": [
          [
            "gpu",
            "nvidia",
            "compute"
          ]
        ],
        "Options": {
          "property1": "string",
          "property2": "string"
        }
      }
    ],
    "MemorySwappiness": 60,
    "OomKillDisable": false,
    "OomScoreAdj": 500,
    "PidMode": "",
    "PidsLimit": 0,
    "PortBindings": {
      "22/tcp": [
        {
          "HostPort": "11022"
        }
      ]
    },
    "PublishAllPorts": false,
    "Privileged": false,
    "ReadonlyRootfs": false,
    "Dns": [
      "8.8.8.8"
    ],
    "DnsOptions": [
      ""
    ],
    "DnsSearch": [
      ""
    ],
    "VolumesFrom": [
      "parent",
      "other:ro"
    ],
    "CapAdd": [
      "NET_ADMIN"
    ],
    "CapDrop": [
      "MKNOD"
    ],
    "GroupAdd": [
      "newgroup"
    ],
    "RestartPolicy": {
      "Name": "",
      "MaximumRetryCount": 0
    },
    "AutoRemove": true,
    "NetworkMode": "bridge",
    "Devices": [],
    "Ulimits": [
      {}
    ],
    "LogConfig": {
      "Type": "json-file",
      "Config": {}
    },
    "SecurityOpt": [],
    "StorageOpt": {},
    "CgroupParent": "",
    "VolumeDriver": "",
    "ShmSize": 67108864
  },
  "NetworkingConfig": {
    "EndpointsConfig": {
      "isolated_nw": {
        "IPAMConfig": {
          "IPv4Address": "172.20.30.33",
          "IPv6Address": "2001:db8:abcd::3033",
          "LinkLocalIPs": [
            "169.254.34.68",
            "fe80::3468"
          ]
        },
        "Links": [
          "container_1",
          "container_2"
        ],
        "Aliases": [
          "server_x",
          "server_y"
        ]
      }
    }
  }
} */


    /*
    body: stringifyJSON(fork({
      AttachStderr: always(true),
      AttachStdout: always(true),
      AttachStdin: always(false),
      Image: always(this.name),
      Cmd: always(args),
      Env: pipe([
        get('env', {}),
        Object.entries,
        map(([key, value]) => `${key}=${value}`),
      ]),
      ExposedPorts: pipe([
        get('expose', []),
        map(port => ({ [port]: {} })),
      ]),
      WorkingDir: get('workdir', '.'),
      Volumes: pipe([
        get('volume', []),
        map(path => ({ [path]: {} })),
      ]),

      Healthcheck: fork({
        Test: get('healthcheck', []),
        Interval: get('healthcheckInterval', 0),
        Timeout: get('healthcheckTimeout', 0),
        Retries: get('healthcheckRetries', 0),
        StartPeriod: get('healthcheckStartPeriod', 0),
      }),
      HostConfig: fork({
        Links: get('links', []),
        Memory: get('memory', 0),
        PortBindings: pipe([
          get('portBindings', {}),
          map(fork({ HostPort: identity })),
        ]),

        RestartPolicy: pipe([
          get('restart', ''),
          split(':'),
          fork({
            Name: get(0, ''),
            MaximumRetryCount: get(1, 0),
          }),
        ]),
        LogConfig: fork({
          Type: get('logDriver', 'json-file'),
          Config: always({}),
        }),
      }),
    })(options)),
    */

module.exports = DockerImage
