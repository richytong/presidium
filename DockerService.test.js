const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerContainer = require('./DockerContainer')
const DockerService = require('./DockerService')
const inspect = require('util').inspect
const always = require('rubico/always')

module.exports = Test('DockerService', DockerService)
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
    replicas: 1,
  }, async function (myService) {
    {
      const info = await myService.inspect()
      this.serviceId = info.ID
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
    }

    {
      const result = await myService.update({
        replicas: 2,
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
      })
    }

    {
      const info = await myService.inspect()
      assert.equal(info.ID, this.serviceId)
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
      assert.equal(info.Spec.Mode.Replicated.Replicas, 2)
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
      assert.equal(info.Spec.TaskTemplate.Resources.Limits.MemoryBytes, 512e6)
      this.myServiceSpec = myService.spec
    }

    {
      const logResponseStream = await myService.getLogs({ stdout: true, stderr: true })
      logResponseStream.pipe(process.stdout)
      await new Promise(resolve => logResponseStream.on('end', resolve))
    }
  })
  .case({
    name: 'my-service',
    image: 'nginx:1.19',
    replicas: 2,
  }, async function (myService) {
    await myService.ready
    // TODO test for update on construction
    assert.deepEqual(myService.spec, this.myServiceSpec)
  })
  .case({
    name: 'bad-request',
    image: 'nginx:1.19',
    replicas: 2,
    restart: 'always', // coulda fooled me
  }, async function (errorService) {
    assert.rejects(
      always(errorService.ready),
      new Error('{"message":"invalid RestartCondition: \\"always\\""}\n'))
  })
  .after(async function () {
    await this.docker.pruneContainers()
    await this.docker.pruneImages()
    await this.docker.leaveSwarm({ force: true })
  })
