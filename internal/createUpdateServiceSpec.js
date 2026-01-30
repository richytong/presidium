require('rubico/global')
const { has, isString, identity } = require('rubico/x')
const split = require('./split')

/**
 * @name createUpdateServiceSpec
 *
 * @docs
 * ```coffeescript [specscript]
 * createUpdateServiceSpec(options {
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
 *   memory: number, // memory limit in bytes
 *   cpus: number, // number of cpus
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
 *
 *   force?: boolean,
 * }) -> updateServicePartialSpec Object
 * ```
 */
const createUpdateServiceSpec = function (options) {
  const result = omit(options.Spec, []) // deep copy
  result.Name = options.serviceName

  if (options.labels != null) {
    result.Labels = options.labels
  }
  if (options.image != null) {
    result.TaskTemplate.ContainerSpec.Image = options.image
  }
  if (options.cmd != null) {
    result.TaskTemplate.ContainerSpec.Command = options.cmd
  }
  if (options.env != null) {
    result.TaskTemplate.ContainerSpec.Env =
      Object.entries(options.env).map(([key, value]) => `${key}=${value}`)
  }
  if (options.workdir != null) {
    result.TaskTemplate.ContainerSpec.Dir = options.workdir
  }
  if (options.mounts != null) {
    result.TaskTemplate.ContainerSpec.Mounts = options.mounts.map(pipe([
      switchCase([
        isString,
        pipe([
          split(':'),
          all({ target: get(0), source: get(1), readonly: get(2) }),
        ]),
        identity,
      ]),
      all({
        Target: get('target'),
        Source: get('source'),
        Type: get('type', 'volume'),
        ReadOnly: get('readonly', false),
      }),
    ]))
  }

  if (or(options, [
    has('healthCmd'),
    has('healthInterval'),
    has('healthTimeout'),
    has('healthRetries'),
    has('healthStartPeriod'),
  ])) {
    result.TaskTemplate.ContainerSpec.HealthCheck = {}
  }
  if (options.healthCmd != null) {
    result.TaskTemplate.ContainerSpec.HealthCheck.Test =
      ['CMD', ...options.healthCmd]
  }
  if (options.healthInterval != null) {
    result.TaskTemplate.ContainerSpec.HealthCheck.Interval =
      options.healthInterval
  }
  if (options.healthTimeout != null) {
    result.TaskTemplate.ContainerSpec.HealthCheck.Timeout = options.healthTimeout
  }
  if (options.healthRetries != null) {
    result.TaskTemplate.ContainerSpec.HealthCheck.Retries = options.healthRetries
  }
  if (options.healthStartPeriod != null) {
    result.TaskTemplate.ContainerSpec.HealthCheck.StartPeriod =
      options.healthStartPeriod
  }

  if (or(options, [has('restart'), has('restartDelay')])) {
    result.TaskTemplate.RestartPolicy = {}
  }
  if (options.restart != null) {
    result.TaskTemplate.RestartPolicy = all({
      Condition: get(0),
      MaxAttempts: pipe([get(1, 0), Number]),
    })(options.restart.split(':'))
  }
  if (options.restartDelay != null) {
    result.TaskTemplate.RestartPolicy.Delay = Number(options.restartDelay)
  }
  if (or(options, [has('memory'), has('cpus'), has('gpus')])) {
    result.TaskTemplate.Resources = {}
    result.TaskTemplate.Resources.Reservations = {}
    result.TaskTemplate.Resources.Limits = {}
  }
  if (options.memory != null) {
    result.TaskTemplate.Resources.Reservations.MemoryBytes =
      Number(options.memory)
    result.TaskTemplate.Resources.Limits.MemoryBytes =
      Number(options.memory)
  }
  if (options.cpus != null) {
    result.TaskTemplate.Resources.Reservations.NanoCPUs =
      Number(options.cpus * 1e9)
    result.TaskTemplate.Resources.Limits.NanoCPUs =
      Number(options.cpus * 1e9)
  }
  if (options.gpus != null) {
    result.TaskTemplate.Resources.Reservations.GenericResources = []
    result.TaskTemplate.Resources.Reservations.GenericResources.push({
      DiscreteResourceSpec: {
        Kind: 'gpu',
        Value: 1,
      },
    })
  }
  if (or(options, [has('logDriver'), has('logDriverOptions')])) {
    result.TaskTemplate.LogDriver = {}
  }
  if (options.logDriver != null) {
    result.TaskTemplate.LogDriver.Name = options.logDriver
  }
  if (options.logDriverOptions != null) {
    result.TaskTemplate.LogDriver.Options = options.logDriverOptions
  }
  if (options.force) {
    result.TaskTemplate.ForceUpdate = Date.now()
  }

  if (options.replicas == 'global') {
    result.Mode = { Global: {} }
  }
  else if (options.replicas != null) {
    result.Mode = {
      Replicated: { Replicas: options.replicas }
    }
  }

  if (or(options, [
    has('updateParallelism'),
    has('updateDelay'),
    has('updateFailureAction'),
    has('updateMonitor'),
    has('updateMaxFailureRatio'),
  ])) {
    result.UpdateConfig = {}
  }
  if (options.updateParallelism != null) {
    result.UpdateConfig.Parallelism = options.updateParallelism
  }
  if (options.updateDelay != null) {
    result.UpdateConfig.Delay = options.updateDelay
  }
  if (options.updateFailureAction != null) {
    result.UpdateConfig.FailureAction = options.updateFailureAction
  }
  if (options.updateMonitor != null) {
    result.UpdateConfig.Monitor = options.updateMonitor
  }
  if (options.updateMaxFailureRatio != null) {
    result.UpdateConfig.MaxFailureRatio = options.updateMaxFailureRatio
  }

  if (or(options, [
    has('rollbackParallelism'),
    has('rollbackDelay'),
    has('rollbackFailureAction'),
    has('rollbackMonitor'),
    has('rollbackMaxFailureRatio'),
  ])) {
    result.RollbackConfig = {}
  }
  if (options.rollbackParallelism != null) {
    result.RollbackConfig.Parallelism = options.rollbackParallelism
  }
  if (options.rollbackDelay != null) {
    result.RollbackConfig.Delay = options.rollbackDelay
  }
  if (options.rollbackFailureAction != null) {
    result.RollbackConfig.FailureAction = options.rollbackFailureAction
  }
  if (options.rollbackMonitor != null) {
    result.RollbackConfig.Monitor = options.rollbackMonitor
  }
  if (options.rollbackMaxFailureRatio != null) {
    result.RollbackConfig.MaxFailureRatio = options.rollbackMaxFailureRatio
  }

  if (options.network != null) {
    result.Networks = [{
      Target: options.network,
      Aliases: [],
      DriverOpts: {},
    }]
  }

  if (options.publish != null) {
    result.EndpointSpec = {
      Ports: Object.entries(options.publish).map(pipe([
        map(String),
        all({
          Protocol: ([hostPort, containerPort]) => {
            const hostProtocol = hostPort.split('/')[1],
              containerProtocol = containerPort.split('/')[1]
            return hostProtocol ?? containerProtocol ?? 'tcp'
          },
          TargetPort: pipe([get(1), split('/'), get(0), Number]),
          PublishedPort: pipe([get(0), split('/'), get(0), Number]),
          PublishMode: 'ingress',
        }),
      ])),
    }
  }

  return result
}

module.exports = createUpdateServiceSpec
