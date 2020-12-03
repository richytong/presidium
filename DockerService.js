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
 * new DockerService(image string, address string) -> DockerService
 * ```
 *
 * @description
 * One Docker swarm = N Docker services = N ports exposed on every host
 *
 * ```javascript
 * DockerService('my-image:latest', '[::1]:2377')
 * ```
 */
const DockerService = function (image, address) {
  if (this == null || this.constructor != DockerService) {
    return new DockerService(image, address)
  }
  this.docker = new Docker()
  this.http = this.docker.http
  this.image = image
  this.address = address
  return this
}

/**
 * @name DockerService.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(image, address).create({
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

DockerService.prototype.create = function dockerServiceCreate(options) {
  return this.http.post('/services/create', {
    body: stringifyJSON({
      ...options.name && { Name: options.name },
      TaskTemplate: {
        ContainerSpec: {
          Image: this.image,
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
