const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerContainer = require('./DockerContainer')
const DockerService = require('./DockerService')
const inspect = require('util').inspect
const always = require('rubico/always')

const test = new Test('DockerService', DockerService)

.before(async function () {
  this.docker = new Docker()
  await this.docker.leaveSwarm({ force: true })
  await this.docker.pruneContainers()
  await this.docker.pruneImages()
  await this.docker.initSwarm('[::1]:2377')
})

.case({
  name: 'my-service',
  image: 'nginx:1.19',
  replicas: 'global',
}, async function (myService) {
  // first deploy success
  {
    const { message } = await myService.deploy({ waitFor: true })
    assert.equal(message, 'success')
  }

  {
    const info = await myService.inspect()
    this.serviceId = info.ID
    this.serviceVersion = info.Version.Index
    assert.equal(info.ID, this.serviceId)
    assert.equal(info.Spec.UpdateConfig.Parallelism, 2) // defaults
    assert.equal(info.Spec.UpdateConfig.Delay, 1e9)
    assert.equal(info.Spec.UpdateConfig.FailureAction, 'pause')
    assert.equal(info.Spec.UpdateConfig.Monitor, 15e9)
    assert.equal(info.Spec.UpdateConfig.MaxFailureRatio, 0.15)
    assert.equal(info.Spec.RollbackConfig.Parallelism, 1)
    assert.equal(info.Spec.RollbackConfig.Delay, 1e9)
    assert.equal(info.Spec.RollbackConfig.FailureAction, 'pause')
    assert.equal(info.Spec.RollbackConfig.Monitor, 15e9)
    assert.equal(info.Spec.RollbackConfig.MaxFailureRatio, 0.15)
    assert(info.Spec.Mode.Global)
  }

  await myService.update({
    labels: { foo: 'bar' },
    updateParallelism: 3,
    updateDelay: 2e9,
    updateFailureAction: 'continue',
    updateMonitor: 30e9,
    updateMaxFailureRatio: 0.3,
    rollbackParallelism: 3,
    rollbackDelay: 2e9,
    rollbackFailureAction: 'continue',
    rollbackMonitor: 30e9,
    rollbackMaxFailureRatio: 0.3,
    env: { FOO: 'foo' },
    workdir: '/opt',
    mounts: [{
      source: 'other-volume',
      target: '/opt/other-volume',
    }],
    publish: { 8080: 80 },
    healthCmd: ['curl', '0.0.0.0:80'],
    restart: 'on-failure:5',
    memory: 512e6, // bytes
    cpus: 2,
    force: true,
  })

  {
    const info = await myService.inspect()
    this.serviceVersion = info.Version.Index
    assert.equal(info.ID, this.serviceId)
    assert.equal(info.Spec.Labels.foo, 'bar')
    assert.equal(info.Spec.UpdateConfig.Parallelism, 3)
    assert.equal(info.Spec.UpdateConfig.Delay, 2e9)
    assert.equal(info.Spec.UpdateConfig.FailureAction, 'continue')
    assert.equal(info.Spec.UpdateConfig.Monitor, 30e9)
    assert.equal(info.Spec.UpdateConfig.MaxFailureRatio, 0.3)
    assert.equal(info.Spec.RollbackConfig.Parallelism, 3)
    assert.equal(info.Spec.RollbackConfig.Delay, 2e9)
    assert.equal(info.Spec.RollbackConfig.FailureAction, 'continue')
    assert.equal(info.Spec.RollbackConfig.Monitor, 30e9)
    assert.equal(info.Spec.RollbackConfig.MaxFailureRatio, 0.3)
    assert(info.Spec.Mode.Global)
    assert.equal(info.Spec.TaskTemplate.ContainerSpec.Env.length, 1)
    assert.equal(info.Spec.TaskTemplate.ContainerSpec.Env[0], 'FOO=foo')
    assert.equal(info.Spec.TaskTemplate.ContainerSpec.Dir, '/opt')
    assert.deepEqual(
      info.Spec.TaskTemplate.ContainerSpec.Healthcheck.Test,
      ['CMD', 'curl', '0.0.0.0:80'])
    assert.deepEqual(
      info.Spec.TaskTemplate.ContainerSpec.Mounts,
      [{ Type: 'volume', Source: 'other-volume', Target: '/opt/other-volume' }])
    assert.equal(info.Spec.TaskTemplate.RestartPolicy.Condition, 'on-failure')
    assert.equal(info.Spec.TaskTemplate.RestartPolicy.MaxAttempts, 5)
    assert.equal(info.Spec.TaskTemplate.Resources.Reservations.MemoryBytes, 512e6)
    assert.equal(info.Spec.TaskTemplate.Resources.Reservations.NanoCPUs, 2e9)
    this.myServiceSpec = myService.spec
  }

  await myService.update({
    labels: { foo: 'baz' },
    force: true,
  })

  {
    const info = await myService.inspect()
    assert.equal(info.ID, this.serviceId)
    assert.equal(info.Spec.Labels.foo, 'baz')
  }

  /* TODO find out why a change to replicas will not be reflected instantly by inspect
  // until then always remove and redeploy a service when changing from
  // global to replicated and vice versa
  await service.update({
    replicas: 2,
  })

  {
    const info = await service.inspect()
    console.log(info)
    assert.equal(info.ID, this.serviceId)
    assert.equal(info.Spec.Mode.Replicated.Replicas, 2)
  }
  */

  {
    const logResponseStream = await myService.getLogs({ stdout: true, stderr: true })
    logResponseStream.pipe(process.stdout)
    await new Promise(resolve => logResponseStream.on('end', resolve))
  }

  // further deploys should update
  {
    const { message } = await myService.deploy()
    assert.equal(message, 'success')
  }

  // further deploys should noop
  {
    const { message } = await myService.deploy({ force: true })
    assert.equal(message, 'success')
  }

})

// deploy new version of service
.case({
  name: 'my-service',
  image: 'nginx:1.20',
  replicas: 1,
}, async function (service) {
  const { message } = await service.deploy({ waitFor: true })
  assert.equal(message, 'success')
})

// deploy another service with replicas
.case({
  name: 'my-replicated-service',
  image: 'nginx:1.20',
  replicas: 1,
}, async function (service) {
  const { message } = await service.deploy()
  assert.equal(message, 'success')

  await service.update({
    replicas: 2,
  })

  {
    const info = await service.inspect()
    assert.equal(info.Spec.Mode.Replicated.Replicas, 2)
  }
})

.case({
  name: 'bad-request',
  image: 'nginx:1.19',
  replicas: 2,
  restart: 'always',
}, async function (errorService) {
  await assert.rejects(
    errorService.deploy(),
    new Error('{"message":"invalid RestartCondition: \\"always\\""}\n')
  )
})

.case({
  name: 'internal-error-service',
  image: 'nginx:1.19',
  replicas: 1,
}, async function (service) {
  const originalDockerInspectService = service.docker.inspectService

  service.docker.inspectService = function respondError() {
    return {
      status: 500,
      async text() {
        return 'Internal Error'
      },
    }
  }

  await assert.rejects(
    service.deploy(),
    new Error('Docker Error: Internal Error')
  )

  service.docker.inspectService = originalDockerInspectService
})

.after(async function () {
  await this.docker.pruneContainers()
  await this.docker.pruneImages()
  await this.docker.leaveSwarm({ force: true })
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
