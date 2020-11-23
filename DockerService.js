const Docker = require('Docker')

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
  this.http = new Docker().http
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
 *   logDriver: 'json-file'|'syslog'|'journald'|'gelf'|'fluentd'|'awslogs'|'splunk'|'none',
 *   logDriverOptions: Object<string>,
 *   publish: Object<(hostPort string)=>(containerPort string)>,
 *   healthcheck: {
 *     test: Array<string>, // healthcheck command configuration. See description
 *     interval: 0|>1e6, // nanoseconds to wait between healthchecks; 0 means inherit
 *     timeout: 0|>1e6, // nanoseconds to wait before healthcheck fails
 *     retries: number, // number of retries before unhealhty
 *     startPeriod: 0|>1e6, // nanoseconds to wait on container init before starting first healthcheck
 *   },
 *   mounts: Array<{
 *     source: string, // name of volume
 *     target: string, // mounted path inside container
 *     readonly: boolean,
 *   }>|Array<string>, // '<source>:<target>[:readonly]'
 *
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
 * }) -> Promise<HttpResponse>
 * ```
 *
 * @description
 * ```javascript
 * DockerService(image, address).create({
 *   replicas: 1,
 * })
 * ```
 */
DockerService.prototype.create = function dockerServiceCreate(options) {
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
