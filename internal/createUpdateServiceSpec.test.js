const Test = require('thunk-test')
const assert = require('assert')
const createUpdateServiceSpec = require('./createUpdateServiceSpec')

const test = new Test('createUpdateServiceSpec', createUpdateServiceSpec)

.case({
  serviceName: 'my-service',
  spec: {},
}, {
  Name: 'my-service',
})

.case({
  serviceName: 'my-service',
  spec: {},
  labels: { a: 1 },
}, {
  Name: 'my-service',
  Labels: { a: 1 },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  image: 'nginx:1.19',
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Image: 'nginx:1.19',
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  cmd: ['node', 'entrypoint'],
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Command: ['node', 'entrypoint'],
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  env: {
    HELLO: 'WORLD',
    SECRET: 'mysecret',
  },
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Env: ['HELLO=WORLD', 'SECRET=mysecret'],
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  workdir: '/home/ec2-user',
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Dir: '/home/ec2-user',
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  mounts: [
    'my/target:my/source',
    { source: 'my/other/source', target: 'my/other/target', readonly: true },
  ],
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Mounts: [
        {
          Target: 'my/target',
          Source: 'my/source',
          ReadOnly: false,
          Type: 'volume',
        },
        {
          Target: 'my/other/target',
          Source: 'my/other/source',
          ReadOnly: true,
          Type: 'volume',
        },
      ],
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  mounts: [
    'my/target:my/source',
    { source: 'my/other/source', target: 'my/other/target', readonly: true },
  ],
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      Mounts: [
        {
          Target: 'my/target',
          Source: 'my/source',
          ReadOnly: false,
          Type: 'volume',
        },
        {
          Target: 'my/other/target',
          Source: 'my/other/source',
          ReadOnly: true,
          Type: 'volume',
        },
      ],
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {
      ContainerSpec: {},
    },
  },
  healthCmd: ['curl', '127.0.0.1:8080/health'],
  healthInterval: 1000,
  healthTimeout: 1000,
  healthRetries: 5,
  healthStartPeriod: 1000,
}, {
  Name: 'my-service',
  TaskTemplate: {
    ContainerSpec: {
      HealthCheck: {
        Test: ['CMD', 'curl', '127.0.0.1:8080/health'],
        Interval: 1000,
        Timeout: 1000,
        Retries: 5,
        StartPeriod: 1000,
      },
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {},
  },
  restart: 'on-failure:5',
}, {
  Name: 'my-service',
  TaskTemplate: {
    RestartPolicy: {
      Condition: 'on-failure',
      MaxAttempts: 5,
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {},
  },
  restart: 'on-failure',
  restartDelay: 1000,
}, {
  Name: 'my-service',
  TaskTemplate: {
    RestartPolicy: {
      Condition: 'on-failure',
      MaxAttempts: 0,
      Delay: 1000,
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {},
  },
  memory: 512e6,
  cpus: 2,
}, {
  Name: 'my-service',
  TaskTemplate: {
    Resources: {
      Reservations: {
        MemoryBytes: 512e6,
        NanoCPUs: 2e9,
      },
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {},
  },
  logDriver: 'json-file',
  logDriverOptions: {
    'max-size': '10m',
    'max-file': '3',
  },
}, {
  Name: 'my-service',
  TaskTemplate: {
    LogDriver: {
      Name: 'json-file',
      Options: {
        'max-size': '10m',
        'max-file': '3',
      },
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {
    TaskTemplate: {},
  },
  force: true,
}, spec => {
  assert.equal(spec.Name, 'my-service')
  assert.equal(typeof spec.TaskTemplate.ForceUpdate, 'number')
})

.case({
  serviceName: 'my-service',
  spec: {},
  replicas: 'global',
}, {
  Name: 'my-service',
  Mode: {
    Global: {},
  },
})

.case({
  serviceName: 'my-service',
  spec: {},
  replicas: 3,
}, {
  Name: 'my-service',
  Mode: {
    Replicated: {
      Replicas: 3,
    },
  },
})

.case({
  serviceName: 'my-service',
  spec: {},
  updateParallelism: 3,
  updateDelay: 2e9,
  updateFailureAction: 'continue',
  updateMonitor: 30e9,
  updateMaxFailureRatio: 0.3,
}, {
  Name: 'my-service',
  UpdateConfig: {
    Parallelism: 3,
    Delay: 2e9,
    FailureAction: 'continue',
    Monitor: 30e9,
    MaxFailureRatio: 0.3,
  },
})

.case({
  serviceName: 'my-service',
  spec: {},
  rollbackParallelism: 3,
  rollbackDelay: 2e9,
  rollbackFailureAction: 'continue',
  rollbackMonitor: 30e9,
  rollbackMaxFailureRatio: 0.3,
}, {
  Name: 'my-service',
  RollbackConfig: {
    Parallelism: 3,
    Delay: 2e9,
    FailureAction: 'continue',
    Monitor: 30e9,
    MaxFailureRatio: 0.3,
  },
})

.case({
  serviceName: 'my-service',
  spec: {},
  network: 'my-network',
}, {
  Name: 'my-service',
  Networks: [{
    Target: 'my-network',
    Aliases: [],
    DriverOpts: {},
  }],
})

.case({
  serviceName: 'my-service',
  spec: {},
  publish: { 3000: 8080 },
}, {
  Name: 'my-service',
  EndpointSpec: {
    Ports: [{
      Protocol: 'tcp',
      TargetPort: 8080,
      PublishedPort: 3000,
      PublishMode: 'ingress',
    }],
  },
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
