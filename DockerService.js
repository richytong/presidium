const Docker = require('Docker')

/**
 * @name DockerService
 *
 * @synopsis
 * ```coffeescript [specscript]
 * new DockerService(servicename string) -> DockerService
 * ```
 *
 * @description
 * The name of a DockerService corresponds 1:1 with a DockerImage. The name should be the name of the Docker image.
 */
const DockerService = function (name) {
  if (this == null || this.constructor != DockerService) {
    return new DockerService(name)
  }
  this.http = new Docker().http
  this.name = name
  this.mounts = []
  return this
}

/**
 * @name DockerService.prototype.withVolume
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(name)
 *   .withVolume(name string, containerPath string, {
 *     readonly: boolean,
 *     labels: Object<string>,
 *   })
 *   .apply()
 * ```
 */
DockerService.prototype.withVolume = function dockerServiceWithVolume(
  name, containerPath, options,
) {
  this.mounts.push({
    Type: 'volume',
    Source: name,
    Target: containerPath,
    ReadOnly: get('readonly', false)(options),
  })
  return this
}

/**
 * @namae DockerService.prototype.create
 *
 * @synopsis
 * ```coffeescript [specscript]
 * DockerService(name).create(options {
 *   replicas: number,
 *   hosts: Array<string>,
 *   mounts: Array<DockerVolume>,
 * })
 * ```
 */
DockerService.prototype.create = function create(tasks) {
  return this
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
