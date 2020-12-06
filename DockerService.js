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

/**
 * @name DockerService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService(name string) -> DockerService
 * ```
 *
 * @description
 * One Docker swarm = N Docker services = N ports exposed on every host
 *
 * ```javascript
 * DockerService('my-image:latest', '[::1]:2377')
 * ```
 */
const DockerService = function (name, options) {
  if (this == null || this.constructor != DockerService) {
    return new DockerService(name, options)
  }
  this.name = name
  this.docker = new Docker()
  this.version = null
  this.spec = null
  this.ready = this.docker.inspectService(this.name).then(switchCase([
    eq(404, get('status')),
    async () => {
      const create = await this.docker.createService(this.name, options)
      await this.synchronize()
    },
    async response => {
      const body = await response.json()
      this.version = body.Version.Index
      this.spec = body.Spec
    },
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
 * @name DockerService.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(name).create({
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
 * }) -> {}
 * ```
 *
 * @description
 * ```javascript
 * const myService = new DockerService('my-service', {
 *   image: 'my-app:latest',
 *   env: { FOO: 'foo', BAR: 'bar' },
 *   cmd: ['npm', 'start'],
 *   replicas: 5,
 *   restart: 'on-failure',
 *   publish: { 3000: 3000 }, // hostPort: containerPort
 *   healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3000'],
 *   mounts: ['my-volume:/opt/data/my-volume:readonly']
 *   logDriver: 'json-file',
 *   logDriverOptions: { 'max-file': '10', 'max-size': '100m' },
 * })
 * ```
 */
DockerService.prototype.create = async function dockerServiceCreate(options) {
  await this.ready
  return this.docker.createService(this.name, options)
    .then(response => response.json())
}

/**
 * @name DockerService.prototype.update
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(name)
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

/* {
  "Name": "web",
  "TaskTemplate": {
    "ContainerSpec": {
      "Image": "nginx:alpine",
      "Mounts": [
        {
          "ReadOnly": true,
          "Source": "web-data",
          "Target": "/usr/share/nginx/html",
          "Type": "volume",
          "VolumeOptions": {
            "DriverConfig": {},
            "Labels": {
              "com.example.something": "something-value"
            }
          }
        }
      ],
      "Hosts": [
        "10.10.10.10 host1",
        "ABCD:EF01:2345:6789:ABCD:EF01:2345:6789 host2"
      ],
      "User": "33",
      "DNSConfig": {
        "Nameservers": [
          "8.8.8.8"
        ],
        "Search": [
          "example.org"
        ],
        "Options": [
          "timeout:3"
        ]
      },
      "Secrets": [
        {
          "File": {
            "Name": "www.example.org.key",
            "UID": "33",
            "GID": "33",
            "Mode": 384
          },
          "SecretID": "fpjqlhnwb19zds35k8wn80lq9",
          "SecretName": "example_org_domain_key"
        }
      ]
    },
    "LogDriver": {
      "Name": "json-file",
      "Options": {
        "max-file": "3",
        "max-size": "10M"
      }
    },
    "Placement": {},
    "Resources": {
      "Limits": {
        "MemoryBytes": 104857600
      },
      "Reservations": {}
    },
    "RestartPolicy": {
      "Condition": "on-failure",
      "Delay": 10000000000,
      "MaxAttempts": 10
    }
  },
  "Mode": {
    "Replicated": {
      "Replicas": 4
    }
  },
  "UpdateConfig": {
    "Parallelism": 2,
    "Delay": 1000000000,
    "FailureAction": "pause",
    "Monitor": 15000000000,
    "MaxFailureRatio": 0.15
  },
  "RollbackConfig": {
    "Parallelism": 1,
    "Delay": 1000000000,
    "FailureAction": "pause",
    "Monitor": 15000000000,
    "MaxFailureRatio": 0.15
  },
  "EndpointSpec": {
    "Ports": [
      {
        "Protocol": "tcp",
        "PublishedPort": 8080,
        "TargetPort": 80
      }
    ]
  },
  "Labels": {
    "foo": "bar"
  }
} */

module.exports = DockerService
