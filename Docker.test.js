require('rubico/global')
const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const resolvePath = require('./internal/resolvePath')
const sleep = require('./internal/sleep')
const Readable = require('./Readable')

const test1 = Test('Docker - prune', async function integration() {
  const docker = new Docker({ apiVersion: '1.44' })

  await docker.leaveSwarm({ force: true }).catch(() => {})
  await docker.pruneContainers()
  await docker.pruneVolumes()
  await docker.pruneImages()
  await docker.pruneNetworks()

  {
    const data = await docker.pruneContainers()
    assert.equal(data.ContainersDeleted.length, 0)
    assert.equal(data.SpaceReclaimed, 0)
  }

  {
    const data = await docker.pruneVolumes()
    assert.equal(data.VolumesDeleted.length, 0)
    assert.equal(data.SpaceReclaimed, 0)
  }

  {
    const data = await docker.pruneImages()
    assert.equal(data.ImagesDeleted.length, 0)
    assert.equal(data.SpaceReclaimed, 0)
  }

  {
    const data = await docker.pruneNetworks()
    assert.equal(data.NetworksDeleted.length, 0)
  }

}).case()

const test2 = new Test('Docker - auth', async function integration() {
  const docker = new Docker({ apiVersion: '1.44' })

  const data = await docker.auth({
    username: 'admin',
    password: 'password',
    email: 'test@example.com',
    serveraddress: 'localhost:5000',
  })
  assert.equal(typeof data.Status, 'string')
}).case()

const test3 = new Test('Docker - image', async function integration() {
  const docker = new Docker({ apiVersion: '1.44' })

  await docker.removeImage('presidium-test:test').catch(() => {})
  await docker.removeImage('localhost:5000/presidium-test:test').catch(() => {})

  { // pull node-15:alpine
    const dataStream = await docker.pullImage('node:15-alpine')
    dataStream.pipe(process.stdout)
    await new Promise(resolve => dataStream.on('end', resolve))
  }

  {
    const dataStream = await docker.buildImage(__dirname, {
      image: 'presidium-test:test',
      archive: {
        Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8888`,
      },
    })
    dataStream.pipe(process.stdout)
    await new Promise(resolve => {
      dataStream.on('end', resolve)
    })
  }

  {
    const data = await docker.listImages()
    assert(data.length >= 2)
    for (const imageData of data) {
      assert.equal(typeof imageData.Id, 'string')
      assert.equal(typeof imageData.ParentId, 'string')
      assert(['string', 'number'].includes(typeof imageData.Created))
      assert.equal(typeof imageData.Size, 'number')
      assert.equal(typeof imageData.SharedSize, 'number')
    }
  }

  {
    const data = await docker.tagImage(
      'presidium-test:test',
      'localhost:5000/presidium-test:test'
    )
    assert.equal(Object.keys(data).length, 0)
  }

  {
    const dataStream = await docker.pushImage({
      image: 'presidium-test:test',
      registry: 'localhost:5000',
      identitytoken: this.identitytoken,
    })
    dataStream.pipe(process.stdout)
    await new Promise(resolve => {
      dataStream.on('end', resolve)
    })
  }

  {
    const data = await docker.inspectImage('localhost:5000/presidium-test:test')
    assert.equal(typeof data.Id, 'string')
    assert(['string', 'number'].includes(typeof data.Created))
    assert.equal(typeof data.Size, 'number')
    assert.equal(typeof data.Architecture, 'string')
    assert.equal(typeof data.Os, 'string')
  }

  {
    const data1 = await docker.removeImage('presidium-test:test')
    assert(data1.length  > 0)
    for (const item of data1) {
      assert(item.Untagged || item.Deleted)
    }

    const data2 = await docker.removeImage('localhost:5000/presidium-test:test')
    assert(data2.length > 0)
    for (const item of data2) {
      assert(item.Untagged || item.Deleted)
    }
  }

}).case()

const test4 = new Test('Docker - container', async function integration() {
  const docker = new Docker({ apiVersion: '1.44' })

  {
    const data = await docker.createContainer({
      name: `test-alpine-3-${Date.now()}`,
      image: 'node:15-alpine',
      cmd: ['node', '-e', 'console.log(\'test0\')'],
      rm: true,
    })
    assert.equal(typeof data.Id, 'string')
    assert(Array.isArray(data.Warnings))
    const containerId = data.Id

    const inspectData = await docker.inspectContainer(containerId)
    assert.notEqual(inspectData.HostConfig.NanoCpus, 1e9)
    assert.notEqual(inspectData.HostConfig.Memory, 256e6)

    const attachDataStream = await docker.attachContainer(containerId)
    const emptyAttachDataStream = await docker.attachContainer(containerId, {
      stdout: false,
    })
    const startMessage = await docker.startContainer(containerId)
    assert.equal(typeof startMessage, 'string')


    const body = await Readable.Buffer(attachDataStream)
    assert.equal(body.constructor, Buffer)
    assert.strictEqual(body[0], 1) // stdout
    assert.strictEqual(body[1], 0) // empty
    assert.strictEqual(body[2], 0) // empty
    assert.strictEqual(body[3], 0) // empty
    assert.strictEqual(body[4], 0) // SIZE1
    assert.strictEqual(body[5], 0) // SIZE2
    assert.strictEqual(body[6], 0) // SIZE3
    assert.strictEqual(body[7], 6) // SIZE4
    assert.strictEqual(body.slice(8).toString('utf8'), 'test0\n')

    this.removedContainerId = containerId

    const emptyBody = await Readable.Buffer(emptyAttachDataStream)
    assert.equal(Buffer.byteLength(emptyBody, 'utf8'), 0)
    assert.equal(emptyBody.slice(8).toString('utf8'), '')
  }

  {
    const data = await docker.createContainer({
      name: `test-alpine-30-${Date.now()}`,
      image: 'node:15-alpine',
      cmd: ['node', '-e', 'console.error(\'test0\')'],
      rm: true,
    })
    assert.equal(typeof data.Id, 'string')
    assert(Array.isArray(data.Warnings))
    const containerId = data.Id

    const inspectData = await docker.inspectContainer(containerId)
    assert.notEqual(inspectData.HostConfig.NanoCpus, 1e9)
    assert.notEqual(inspectData.HostConfig.Memory, 256e6)

    const attachDataStream = await docker.attachContainer(containerId)
    const emptyAttachDataStream = await docker.attachContainer(containerId, {
      stderr: false,
    })
    const startMessage = await docker.startContainer(containerId)
    assert.equal(typeof startMessage, 'string')

    const body = await Readable.Buffer(attachDataStream)
    assert.equal(body.constructor, Buffer)
    assert.strictEqual(body[0], 2) // stderr
    assert.strictEqual(body[1], 0) // empty
    assert.strictEqual(body[2], 0) // empty
    assert.strictEqual(body[3], 0) // empty
    assert.strictEqual(body[4], 0) // SIZE1
    assert.strictEqual(body[5], 0) // SIZE2
    assert.strictEqual(body[6], 0) // SIZE3
    assert.strictEqual(body[7], 6) // SIZE4
    assert.strictEqual(body.slice(8).toString('utf8'), 'test0\n')

    this.removedContainerId2 = containerId

    const emptyBody = await Readable.Buffer(emptyAttachDataStream)
    assert.equal(Buffer.byteLength(emptyBody, 'utf8'), 0)
    assert.equal(emptyBody.slice(8).toString('utf8'), '')
  }

  {
    const data = await docker.createContainer({
      name: `test-alpine-1-${Date.now()}`,
      image: 'node:15-alpine',
      cmd: ['node', '-e', 'console.log(\'test\')'],
      workdir: '/opt/test0',
      expose: [22, 8888, '8889/udp'],
      env: { TEST: 'test' },
      volume: ['/opt/my-volume'],
      mounts: [{
        source: 'other-volume',
        target: '/opt/other-volume',
        readonly: true,
      }],
      memory: 256e6, // bytes
      cpus: 0.1,
      restart: 'on-failure:5',

      healthCmd: ['echo', 'ok'],
      healthInterval: 1e9,
      healthTimeout: 30e9,
      healthRetries: 10,
      healthStartPeriod: 5e9,

      publish: {
        23: 22, // hostPort -> containerPort[/protocol]
        8888: '8000/tcp',
      },
      logDriver: 'json-file',
      logDriverOptions: {
        'max-file': '10',
        'max-size': '100m',
      },
    })
    const containerId = data.Id

    const inspectData = await docker.inspectContainer(containerId)
    assert.equal(inspectData.HostConfig.NanoCpus, 1e8)
    assert.equal(inspectData.HostConfig.Memory, 256e6)

    const attachDataStream = await docker.attachContainer(containerId)
    const startMessage = await docker.startContainer(containerId)
    assert.equal(typeof startMessage, 'string')

    const body = await Readable.Buffer(attachDataStream)
    assert.equal(body.constructor, Buffer)
    assert.strictEqual(body[0], 1) // stdout
    assert.strictEqual(body[1], 0) // empty
    assert.strictEqual(body[2], 0) // empty
    assert.strictEqual(body[3], 0) // empty
    assert.strictEqual(body[4], 0) // SIZE1
    assert.strictEqual(body[5], 0) // SIZE2
    assert.strictEqual(body[6], 0) // SIZE3
    assert.strictEqual(body[7], 5) // SIZE4
    assert.strictEqual(body.slice(8).toString('utf8'), 'test\n')

    this.containerId = containerId
  }

  {
    const data = await docker.createContainer({
      name: `test-alpine-2-${Date.now()}`,
      image: 'node:15-alpine',
      cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'x0\')).listen(2999)'],
      rm: true,
    })
    const containerId = data.Id
    const startMessage = await docker.startContainer(containerId)
    assert.equal(typeof startMessage, 'string')
    const execDataStream = await docker.execContainer(containerId, ['node', '-e', 'console.log(\'test123\')'])
    const body = await Readable.Buffer(execDataStream)
    assert.equal(body.constructor, Buffer)
    assert.strictEqual(body[0], 1) // stdout
    assert.strictEqual(body[1], 0) // empty
    assert.strictEqual(body[2], 0) // empty
    assert.strictEqual(body[3], 0) // empty
    assert.strictEqual(body[4], 0) // SIZE1
    assert.strictEqual(body[5], 0) // SIZE2
    assert.strictEqual(body[6], 0) // SIZE3
    assert.strictEqual(body[7], 8) // SIZE4
    assert.strictEqual(body.slice(8).toString('utf8'), 'test123\n')
    await docker.stopContainer(containerId, { time: 1 })
  }

  {
    const runStream = await docker.runContainer({
      name: `test-alpine-4-${Date.now()}`,
      image: 'node:15-alpine',
      cmd: ['node', '-e', 'console.log(\'x0\')'],
      rm: true,
    })
    const body = await Readable.Buffer(runStream)
    assert.equal(body.constructor, Buffer)
    assert.strictEqual(body[0], 1) // stdout
    assert.strictEqual(body[1], 0) // empty
    assert.strictEqual(body[2], 0) // empty
    assert.strictEqual(body[3], 0) // empty
    assert.strictEqual(body[4], 0) // SIZE1
    assert.strictEqual(body[5], 0) // SIZE2
    assert.strictEqual(body[6], 0) // SIZE3
    assert.strictEqual(body[7], 3) // SIZE4
    assert.strictEqual(body.slice(8).toString('utf8'), 'x0\n')
  }

  await assert.rejects(
    docker.removeImage('node:15-alpine'),
    error => {
      assert(error.message.includes('conflict'))
      assert.equal(error.code, 409)
      return true
    },
  )

  {
    const data = await docker.inspectContainer(this.containerId)
    assert.equal(data.Config.Image, 'node:15-alpine')
    assert.deepEqual(data.Config.Volumes, { '/opt/my-volume': {} })
    assert.equal(data.Config.WorkingDir, '/opt/test0')
    assert.deepEqual(data.Config.ExposedPorts, { '22/tcp': {}, '8888/tcp': {}, '8889/udp': {} })
    assert.equal(data.HostConfig.Memory, 256e6)
    assert.deepEqual(data.HostConfig.PortBindings, {
      '22/tcp': [{ HostIp: '', HostPort: '23' }],
      '8000/tcp': [{ HostIp: '', HostPort: '8888' }]
    })
    assert.deepEqual(data.HostConfig.LogConfig, {
      Type: 'json-file',
      Config: {
        'max-file': '10',
        'max-size': '100m',
      },
    })
    assert.deepEqual(data.Config.Healthcheck, {
      Test: ['CMD', 'echo', 'ok'],
      Interval: 1000000000,
      Timeout: 30000000000,
      StartPeriod: 5000000000,
      Retries: 10,
    })
    assert.deepEqual(data.HostConfig.Mounts, [{
      Type: 'volume',
      Source: 'other-volume',
      Target: '/opt/other-volume',
      ReadOnly: true
    }])
  }

  {
    const data = await docker.listContainers()
    assert(data.length > 0)
    assert(!data.map(get('Id')).includes(this.removedContainerId))
    assert(!data.map(get('Id')).includes(this.removedContainerId2))
    for (item of data) {
      assert.equal(typeof item.Id, 'string')
      assert.equal(typeof item.Image, 'string')
      assert.equal(typeof item.State, 'string')
    }
  }

}).case()

const test5 = new Test('Docker - swarm', async function integration() {
  const docker = new Docker({ apiVersion: '1.44' })

  await docker.leaveSwarm({ force: true }).catch(() => {})

  { // initSwarm
    const nodeId = await docker.initSwarm('[::1]:2377')
    assert.equal(typeof nodeId, 'string')
  }

  { // listNodes
    const nodes = await docker.listNodes()
    assert.equal(nodes.length, 1) // just this computer
    this.nodeId = nodes[0].ID
  }

  // attempt deleteNode
  await assert.rejects(
    docker.deleteNode(this.nodeId),
    error => {
      assert(error instanceof Error)
      assert.equal(error.code, 400)
      return true
    },
  )

  { // inspectSwarm
    const data = await docker.inspectSwarm()
    assert.equal(typeof data.JoinTokens.Worker, 'string')
    assert.equal(typeof data.JoinTokens.Manager, 'string')
    this.managerJoinToken = data.JoinTokens.Manager
    this.workerJoinToken = data.JoinTokens.Worker
  }

  { // createNetwork
    const data1 = await docker.createNetwork({
      name: 'my-network',
      driver: 'overlay',
      subnet: '10.11.0.0/20',
      gateway: '10.11.0.1',
    })
    assert.equal(typeof data1.Id, 'string')

    const data2 = await docker.createNetwork({
      name: 'my-other-network',
      driver: 'overlay',
    })
    assert.equal(typeof data2.Id, 'string')
  }

  { // inspect my-network
    const data = await docker.inspectNetwork('my-network')
    assert.equal(typeof data.Id, 'string')
    assert.equal(data.Scope, 'swarm')
  }

  { // create a service
    const data1 = await docker.createService('service1', {
      image: 'node:15-alpine',
      labels: { foo: 'bar' },
      replicas: 2,
      cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'service1\')).listen(3000)'],
      workdir: '/opt/test0',
      env: { TEST: 'test' },
      mounts: [{
        source: 'other-volume',
        target: '/opt/other-volume',
        readonly: true,
      }],
      memory: 256e6, // bytes
      cpus: 0.1,
      gpus: 'all',
      restart: 'on-failure:5',

      healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3000'],
      healthInterval: 1e9,
      healthTimeout: 30e9,
      healthRetries: 10,
      healthStartPeriod: 5e9,

      publish: {
        // 23: 22, // hostPort -> containerPort[/protocol]
        8080: 3000,
      },

      logDriver: 'json-file',
      logDriverOptions: {
        'max-file': '10',
        'max-size': '100m',
      },
      network: 'my-network',
    })
    const serviceId = data1.ID

    const data2 = await docker.inspectService(serviceId)
    assert.equal(data2.Spec.Labels.foo, 'bar')
    assert.equal(data2.Spec.TaskTemplate.Resources.Reservations.NanoCPUs, 100000000)
    assert.equal(data2.Spec.TaskTemplate.Resources.Reservations.MemoryBytes, 256000000)

    this.serviceId1 = serviceId

  }

  { // create the same service
    const p = docker.createService('service1', {
      image: 'node:15-alpine',
      labels: { foo: 'bar' },
      replicas: 2,
      cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'service1\')).listen(3000)'],
      workdir: '/opt/test0',
      env: { TEST: 'test' },
      mounts: [{
        source: 'other-volume',
        target: '/opt/other-volume',
        readonly: true,
      }],
      memory: 256e6, // bytes
      cpus: 0.1,
      gpus: 'all',
      restart: 'on-failure:5',

      healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3000'],
      healthInterval: 1e9,
      healthTimeout: 30e9,
      healthRetries: 10,
      healthStartPeriod: 5e9,

      publish: {
        // 23: 22, // hostPort -> containerPort[/protocol]
        8080: 3000,
      },

      logDriver: 'json-file',
      logDriverOptions: {
        'max-file': '10',
        'max-size': '100m',
      },
      network: 'my-network',
    })

    await assert.rejects(p, error => {
      return true
    })

  }

  { // create another service
    const data1 = await docker.createService('service2', {
      image: 'node:15-alpine',
      replicas: 'global',
      cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'service2\')).listen(3001)'],
      workdir: '/opt/test0',
      env: { TEST: 'test' },
      mounts: [{
        source: 'other-volume',
        target: '/opt/other-volume',
        readonly: true,
      }],
      restart: 'on-failure',
      publish: { 8081: 3001 },

      healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3001'],
    })
    const serviceId = data1.ID

    const data2 = await docker.inspectService(serviceId)
    assert.equal(Object.keys(data2.Spec.TaskTemplate.Resources.Reservations), 0)

    this.serviceId2 = serviceId
  }

  await sleep(1000)

  { // updateService
    const data1 = await docker.updateService('service2', {
      image: 'node:17-alpine',
      memory: 256e6, // bytes
      cpus: 0.1,
    })
    assert.equal(data1.Warnings, null)

    const data2 = await docker.inspectService(this.serviceId2)
    assert.equal(data2.Spec.TaskTemplate.Resources.Reservations.NanoCPUs, 100000000)
    assert.equal(data2.Spec.TaskTemplate.Resources.Reservations.MemoryBytes, 256000000)
  }

  { // listServices
    let data = await docker.listServices()
    while (data.length < 2) {
      await sleep(1000)
      data = await docker.listServices()
    }
    assert.equal(data.length, 2)
    const serviceIds = data.map(get('ID'))
    assert(serviceIds.includes(this.serviceId1))
    assert(serviceIds.includes(this.serviceId2))
  }

  { // listTasks
    let data = await docker.listTasks()
    while (data.length < 4) {
      await sleep(1000)
      data = await docker.listTasks()
    }
    assert.equal(data.length, 4, data) // 2 for service1, 1 for service2 (global), 1 for service2 (update)
    for (const item of data) {
      assert.equal(typeof item.ID, 'string')
      assert.equal(typeof item.Version, 'object')
      assert.equal(typeof item.Spec, 'object')
      assert.equal(typeof item.ServiceID, 'string')
      assert.equal(typeof item.Status, 'object')
      assert.equal(typeof item.DesiredState, 'string')
    }
  }

  { // listTasks filter
    const data = await docker.listTasks({ desiredState: 'accepted' })
    assert.equal(data.length, 0)
  }

  { // listTasks filter
    const data = await docker.listTasks({ service: 'service2' })
    assert.equal(data.length, 2)
    assert.equal(data[0].ServiceID, this.serviceId2)
    assert.equal(data[1].ServiceID, this.serviceId2)
  }

  { // deleteService
    const message = await docker.deleteService(this.serviceId1)
    assert.equal(typeof message, 'string')
  }

  { // listServices after deleteService
    const data = await docker.listServices()
    assert.equal(data.length, 1)
  }

  // join own swarm
  await assert.rejects(
    docker.joinSwarm('[::1]:2377', {
      RemoteAddrs: ['[::1]:2377'],
      JoinToken: this.managerJoinToken,
    }),
    error => {
      assert(error instanceof Error)
      assert.equal(error.code, 503)
      return true
    },
  )

  // leaveSwarm without forcing
  await assert.rejects(
    docker.leaveSwarm(),
    error => {
      assert(error instanceof Error)
      assert.equal(error.code, 503)
      return true
    }
  )

  { // delete networks
    const message1 = await docker.deleteNetwork('my-network')
    assert.equal(typeof message1, 'string')
    const message2 = await docker.deleteNetwork('my-other-network')
    assert.equal(typeof message2, 'string')
  }

  { // force leaveSwarm
    const message = await docker.leaveSwarm({ force: true })
    assert.equal(typeof message, 'string')
  }

}).case()

const test = Test.all([
  test1,
  test2,
  test3,
  test4,
  test5,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
