const rubico = require('rubico')
const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const pathResolve = require('./internal/pathResolve')

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

const test = Test.all([
  Test('Docker - prune', Docker)
  .case(async docker => {
    {
      const response = await docker.pruneContainers()
      assert.equal(response.status, 200)
    }
    {
      const response = await docker.pruneVolumes()
      assert.equal(response.status, 200)
    }
    {
      const response = await docker.pruneImages()
      assert.equal(response.status, 200)
    }
    {
      const response = await docker.pruneNetworks()
      assert.equal(response.status, 200)
    }
  }),

  Test('Docker - auth', Docker)
  .case(async docker => {
    const response = await docker.auth({
      username: 'admin',
      password: 'password',
      email: 'hey@example.com',
      serveraddress: 'localhost:5000',
    })
    assert.equal(response.status, 200)
    const body = await pipe([
      reduce((a, b) => a + b, ''),
      JSON.parse,
    ])(response.body)
    this.identitytoken = get('IdentityToken')(body)
    assert.equal(this.identitytoken, '')
  }),

  Test('Docker - image', Docker)
  .case(async function (docker) {
    { // pull node-15:alpine
      const response = await docker.pullImage('node:15-alpine')
      assert.equal(response.status, 200)
      response.body.pipe(process.stdout)
      await new Promise(resolve => response.body.on('end', resolve))
    }

    {
      const response = await docker.buildImage('presidium-test:ayo', pathResolve(__dirname), {
        archive: {
          Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8888`,
        },
        platform: 'linux/x86_64',
      })
      assert.equal(response.status, 200)
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await docker.listImages()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert(body.length > 1)
      this.initialBodyLength = body.length
    }
    {
      const response = await docker.tagImage('presidium-test:ayo', {
        tag: 'ayo',
        repo: 'localhost:5000/presidium-test',
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await docker.pushImage('presidium-test:ayo', 'localhost:5000', {
        identitytoken: this.identitytoken,
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await docker.inspectImage('localhost:5000/presidium-test:ayo')
      assert.equal(response.status, 200)
    }
    {
      const responses = await Promise.all([
        docker.removeImage('presidium-test:ayo'),
        docker.removeImage('localhost:5000/presidium-test:ayo'),
      ])
      for (const response of responses) {
        const response = await docker.removeImage('presidium-test:ayo')
        assert(response.status == 200 || response.status == 404)
      }
    }
  }),

  Test('Docker - container', Docker)
  .case(async function (docker) {
    {
      const createResponse = await docker.createContainer({
        name: 'test-alpine-3',
        image: 'node:15-alpine',
        cmd: ['node', '-e', 'console.log(\'heyy\')'],
        rm: true,
      })
      assert(createResponse.ok)
      const containerId = (await createResponse.json()).Id
      const attachResponse = await docker.attachContainer(containerId),
        startResponse = await docker.startContainer(containerId)
      assert(startResponse.ok)
      assert(attachResponse.ok)

      const body = await attachResponse.buffer()
      assert.equal(body.constructor, Buffer)
      assert.strictEqual(body[0], 1) // stdout
      assert.strictEqual(body[1], 0) // empty
      assert.strictEqual(body[2], 0) // empty
      assert.strictEqual(body[3], 0) // empty
      assert.strictEqual(body[4], 0) // SIZE1
      assert.strictEqual(body[5], 0) // SIZE2
      assert.strictEqual(body[6], 0) // SIZE3
      assert.strictEqual(body[7], 5) // SIZE4
      assert.strictEqual(body.slice(8).toString(), 'heyy\n')

      this.removedContainerId = containerId
    }

    {
      const createResponse = await docker.createContainer({
        name: 'test-alpine-1',
        image: 'node:15-alpine',
        cmd: ['node', '-e', 'console.log(\'hey\')'],
        workdir: '/opt/heyo',
        expose: [22, 8888, '8889/udp'],
        env: { HEY: 'hey' },
        volume: ['/opt/my-volume'],
        mounts: [{
          source: 'other-volume',
          target: '/opt/other-volume',
          readonly: true,
        }],
        memory: 512e6, // bytes
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
      assert(createResponse.ok)
      const containerId = (await createResponse.json()).Id
      this.containerId = containerId
      const attachResponse = await docker.attachContainer(containerId),
        startResponse = await docker.startContainer(containerId)
      assert(startResponse.ok)
      assert(attachResponse.ok)

      const body = await attachResponse.buffer()
      assert.equal(body.constructor, Buffer)
      assert.strictEqual(body[0], 1) // stdout
      assert.strictEqual(body[1], 0) // empty
      assert.strictEqual(body[2], 0) // empty
      assert.strictEqual(body[3], 0) // empty
      assert.strictEqual(body[4], 0) // SIZE1
      assert.strictEqual(body[5], 0) // SIZE2
      assert.strictEqual(body[6], 0) // SIZE3
      assert.strictEqual(body[7], 4) // SIZE4
      assert.strictEqual(body.slice(8).toString(), 'hey\n')
    }

    {
      const createResponse = await docker.createContainer({
        name: 'test-alpine-2',
        image: 'node:15-alpine',
        cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'hey0\')).listen(2999)'],
        rm: true,
      })
      assert(createResponse.ok)
      const containerId = (await createResponse.json()).Id
      assert((await docker.startContainer(containerId)).ok)
      const execResponse = await docker.execContainer(containerId, ['node', '-e', 'console.log(\'heyyy\')'])
      const body = await execResponse.buffer()
      assert.equal(body.constructor, Buffer)
      assert.strictEqual(body[0], 1) // stdout
      assert.strictEqual(body[1], 0) // empty
      assert.strictEqual(body[2], 0) // empty
      assert.strictEqual(body[3], 0) // empty
      assert.strictEqual(body[4], 0) // SIZE1
      assert.strictEqual(body[5], 0) // SIZE2
      assert.strictEqual(body[6], 0) // SIZE3
      assert.strictEqual(body[7], 6) // SIZE4
      assert.strictEqual(body.slice(8).toString(), 'heyyy\n')
      await docker.stopContainer(containerId, { time: 1 })
    }

    {
      const response = await docker.inspectContainer(this.containerId)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.Config.Image, 'node:15-alpine')
      assert.deepEqual(body.Config.Volumes, { '/opt/my-volume': {} })
      assert.equal(body.Config.WorkingDir, '/opt/heyo')
      assert.deepEqual(body.Config.ExposedPorts, { '22/tcp': {}, '8888/tcp': {}, '8889/udp': {} })
      assert.equal(body.HostConfig.Memory, 512e6)
      assert.deepEqual(body.HostConfig.PortBindings, {
        '22/tcp': [{ HostIp: '', HostPort: '23' }],
        '8000/tcp': [{ HostIp: '', HostPort: '8888' }]
      })
      assert.deepEqual(body.HostConfig.LogConfig, {
        Type: 'json-file',
        Config: {
          'max-file': '10',
          'max-size': '100m',
        },
      })
      assert.deepEqual(body.Config.Healthcheck, {
        Test: ['CMD', 'echo', 'ok'],
        Interval: 1000000000,
        Timeout: 30000000000,
        StartPeriod: 5000000000,
        Retries: 10,
      })
      assert.deepEqual(body.HostConfig.Mounts, [{
        Type: 'volume',
        Source: 'other-volume',
        Target: '/opt/other-volume',
        ReadOnly: true
      }])
    }

    {
      const containersResponse = await docker.listContainers()
      assert.equal(containersResponse.status, 200)
      const body = await containersResponse.json()
      assert(!body.map(get('Id')).includes(this.removedContainerId))
    }
  }),

  Test('Docker - swarm and service', Docker)
  .case(async function (docker) {
    { // initial leaveSwarm
      const response = await docker.leaveSwarm({ force: true })
      assert([200, 503].includes(response.status))
    }

    { // initSwarm
      const response = await docker.initSwarm('[::1]:2377')
      assert.equal(response.status, 200)
    }

    { // listNodes
      const response = await docker.listNodes()
      assert.equal(response.status, 200)
      const nodes = await response.json()
      assert.equal(nodes.length, 1) // just this computer
      this.nodeId = nodes[0].ID
    }

    { // attempt deleteNode
      const response = await docker.deleteNode(this.nodeId)
      assert.equal(response.status, 400)
      console.log(await response.text())
    }

    { // inspectSwarm
      const response = await docker.inspectSwarm()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(typeof body.JoinTokens.Worker, 'string')
      assert.equal(typeof body.JoinTokens.Manager, 'string')
      this.workerJoinToken = body.JoinTokens.Worker
    }

    { // create a network
      const response = await docker.createNetwork({
        name: 'my-network',
        driver: 'overlay',
      })
      assert.equal(response.status, 201)
    }

    { // create a service
      const response = await docker.createService('hey1', {
        image: 'node:15-alpine',
        labels: { foo: 'bar' },
        replicas: 2,
        cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'hey1\')).listen(3000)'],
        workdir: '/opt/heyo',
        env: { HEY: 'hey' },
        mounts: [{
          source: 'other-volume',
          target: '/opt/other-volume',
          readonly: true,
        }],
        memory: 512e6, // bytes
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
      assert.equal(response.status, 201)
      const body = await response.json()
      this.serviceId = body.ID
    }

    { // create another service
      const response = await docker.createService('hey2', {
        image: 'node:15-alpine',
        replicas: 2,
        cmd: ['node', '-e', 'http.createServer((request, response) => response.end(\'hey2\')).listen(3001)'],
        workdir: '/opt/heyo',
        env: { HEY: 'hey' },
        mounts: [{
          source: 'other-volume',
          target: '/opt/other-volume',
          readonly: true,
        }],
        memory: 512e6, // bytes
        restart: 'on-failure',
        publish: { 8081: 3001 },

        healthCmd: ['wget', '--no-verbose', '--tries=1', '--spider', 'localhost:3001'],
      })
      assert.equal(response.status, 201)
    }

    { // listServices
      const response = await docker.listServices()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.length, 2)
    }

    { // listTasks
      const response = await docker.listTasks()
      const body = await response.json()
      assert.equal(body.length, 4) // 2 for hey1, 2 for hey2
    }

    { // inspectService
      const response = await docker.inspectService(this.serviceId)
      assert.equal(response.status, 200)
      const data = await response.json()
      assert.equal(data.Spec.Labels.foo, 'bar')
    }

    { // deleteService
      const response = await docker.deleteService(this.serviceId)
      assert.equal(response.status, 200)
    }

    { // listServices again
      const response = await docker.listServices()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.length, 1)
    }

    { // leaveSwarm without forcing
      const response = await docker.leaveSwarm()
      assert.equal(response.status, 503)
      assert((await response.json()).message.startsWith('You are attempting to leave'))
    }

    { // force leaveSwarm
      const response = await docker.leaveSwarm({ force: true })
      assert.equal(response.status, 200)
    }

    await Promise.all([ // TODO figure out a real test for join. Checking for the 503 is ok but is both slow and not a 200
      docker.joinSwarm('[::1]:2377', this.workerJoinToken, {
        listenAddr: 'hey',
      }).then(async response => {
        console.log('hey1', await response.text())
        // assert.equal(response.status, 503)
        assert.equal(response.status, 400)
      }),
      docker.joinSwarm('[::1]:2377', this.workerJoinToken, {
        advertiseAddr: '[::1]:2377',
        listenAddr: 'hey',
        dataPathAddr: '127.0.0.1',
      }).then(async response => {
        console.log('hey2', await response.text())
        // assert.equal(response.status, 503)
        assert.equal(response.status, 400)
      }),
    ])
  }),
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
