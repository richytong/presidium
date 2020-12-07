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

module.exports = [
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
      {
        const response = await docker.buildImage('presidium-test:ayo', pathResolve(__dirname), {
          archive: {
            Dockerfile: `
  FROM node:15-alpine
  WORKDIR /opt
  COPY . .
  EXPOSE 8888`,
          },
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
        const createResponse = await docker.createContainer('test-alpine-3', {
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
        const createResponse = await docker.createContainer('test-alpine-1', {
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
        const createResponse = await docker.createContainer('test-alpine-2', {
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
      {
        const response = await docker.leaveSwarm({ force: true })
        assert([200, 503].includes(response.status))
      }
      {
        const response = await docker.initSwarm('[::1]:2377')
        assert.equal(response.status, 200)
      }
      {
        const response = await docker.inspectSwarm()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.equal(typeof body.JoinTokens.Worker, 'string')
        assert.equal(typeof body.JoinTokens.Manager, 'string')
        this.workerJoinToken = body.JoinTokens.Worker
      }

      {
        const response = await docker.createService('hey1', {
          image: 'node:15-alpine',
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
            23: 22, // hostPort -> containerPort[/protocol]
            8080: 3000,
          },

          logDriver: 'json-file',
          logDriverOptions: {
            'max-file': '10',
            'max-size': '100m',
          },
        })
        assert.equal(response.status, 201)
        const body = await response.json()
        this.serviceId = body.ID
      }

      {
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
      {
        const response = await docker.listServices()
        assert.equal(response.status, 200)
        const body = await response.json()
        assert.equal(body.length, 2)
      }
      {
        const response = await docker.inspectService(this.serviceId)
        assert.equal(response.status, 200)
      }

      {
        const response = await docker.leaveSwarm()
        assert.equal(response.status, 503)
        assert((await response.json()).message.startsWith('You are attempting to leave'))
      }
      {
        const response = await docker.leaveSwarm({ force: true })
        assert.equal(response.status, 200)
      }
      {
        const response = await docker.joinSwarm('localhost:2377', this.workerJoinToken)
        assert.equal(response.status, 400)
      }
      {
        const response = await docker.joinSwarm('localhost:2377', this.workerJoinToken, {
          advertiseAddr: '[::1]:2377',
          listenAddr: '0.0.0.0:2377',
          dataPathAddr: '[::1]:2377',
        })
        assert.equal(response.status, 400)
      }
    }),
]
