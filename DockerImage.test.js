const assert = require('assert')
const rubico = require('rubico')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerImage = require('./DockerImage')
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

module.exports = Test('DockerImage', DockerImage)
  .before(async function () {
    this.docker = new Docker()
    const response = await this.docker.removeImage('presidium-test:ayo', { force: true })
    assert(response.status == 200 || response.status == 404)
  })
  .case('presidium-test:ayo', async function (dockerImage) {
    {
      const response = await dockerImage.build(pathResolve(__dirname), {
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
      const response = await this.docker.auth({
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
    }

    {
      const response = await this.docker.listImages()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert(body.length > 1)
      this.initialBodyLength = body.length
    }
    {
      const response = await this.docker.tagImage('presidium-test:ayo', {
        tag: 'ayo',
        repo: 'localhost:5000/presidium-test',
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await dockerImage.push('localhost:5000', {
        identitytoken: this.identitytoken,
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await this.docker.inspectImage('localhost:5000/presidium-test:ayo')
      assert.equal(response.status, 200)
    }
  })
  .case('presidium-test:ayoyo', async function (dockerImage) {
    {
      const response = await dockerImage.build(pathResolve(__dirname), {
        archive: {
          'src/Dockerfile': 'FROM busybox:1.32',
        },
        archiveDockerfile: 'src/Dockerfile',
      })
      assert.equal(response.status, 200)
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await this.docker.inspectImage('presidium-test:ayoyo')
      assert.equal(response.status, 200)
    }
    {
      const response = await this.docker.create('presidium-test:ayoyo', {
        cmd: ['sh', '-c', 'echo $HEY'],
        workdir: '/opt/heyo',
        expose: [22, 8888, '8889/udp'],
        env: { HEY: 'hey' },
        volume: ['/opt/my-volume'],
        memory: 512e6, // bytes
        healthcheck: {
          test: ['CMD', 'echo', 'ok'],
          interval: 1e9,
          timeout: 30e9,
          retries: 10,
          startPeriod: 5e9,
        },
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
      assert.equal(response.status, 201)
      const body = await response.json()
      this.containerId = body.Id
    }
    {
      const response = await this.docker.inspect(this.containerId)
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.Config.Image, 'presidium-test:ayoyo')
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
    }
    assert.throws(() => this.docker.create('presidium-test:ayoyo', {
      cmd: ['echo', 'hey'],
      workdir: '/opt',
      expose: [22, 8888, '8889/udp'],
      volume: ['/opt/my-volume'],
      memory: 512e6, // bytes
      healthcheck: {
        // test: ['CMD', 'echo', 'ok'], // absence of test parameter should cause an error
        interval: 1e9,
        timeout: 30e9,
        retries: 10,
        startPeriod: 5e9,
      },
    }), new Error('healthcheck.test parameter required'))
    {
      const attachResponsePromise = this.docker.attach(this.containerId)
      const startResponse = await this.docker.start(this.containerId)
      assert.equal(startResponse.status, 204)
      const attachResponse = await attachResponsePromise
      assert.equal(attachResponse.status, 200)
      const heyFromStdout = await reduce(
        (content, chunk) => Buffer.concat([content, chunk]),
        Buffer.from(''))(attachResponse.body)
      assert.equal(heyFromStdout.constructor, Buffer)
      assert.strictEqual(heyFromStdout[0], 1) // stdout
      assert.strictEqual(heyFromStdout[1], 0) // empty
      assert.strictEqual(heyFromStdout[2], 0) // empty
      assert.strictEqual(heyFromStdout[3], 0) // empty
      assert.strictEqual(heyFromStdout[4], 0) // SIZE1
      assert.strictEqual(heyFromStdout[5], 0) // SIZE2
      assert.strictEqual(heyFromStdout[6], 0) // SIZE3
      assert.strictEqual(heyFromStdout[7], 4) // SIZE4
      assert.strictEqual(heyFromStdout.slice(8).toString(), 'hey\n')
    }
    {
      const response = await this.docker.stop(this.containerId, { time: 1 })
      assert.equal(response.status, 304)
    }
  })
  .after(async function () {
    const responses = await Promise.all([
      this.docker.removeImage('presidium-test:ayo'),
      this.docker.removeImage('localhost:5000/presidium-test:ayo'),
    ])
    for (const response of responses) {
      const response = await this.docker.removeImage('presidium-test:ayo')
      assert(response.status == 200 || response.status == 404)
    }
  })
