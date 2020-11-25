const Test = require('thunk-test')
const assert = require('assert')
const DockerContainer = require('./DockerContainer')
const Docker = require('./Docker')

module.exports = Test('DockerContainer', DockerContainer)
  .before(async function () {
    this.docker = new Docker()
  })
  .case('node:15-alpine', async function (alpine) {
    {
      const response = await alpine.run(['node', '-e', `console.log('heyy')`])

      assert(response.ok)

      const body = await response.buffer()
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
    }

    {
      const response = await alpine.run(['sh', '-c', 'echo $HEY'], {
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

      assert(response.ok)
      this.containerId = response.headers.get('x-presidium-container-id')

      const body = await response.buffer()
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
      const response = await this.docker.inspect(this.containerId)
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
  })
