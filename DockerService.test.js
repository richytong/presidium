const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerService = require('./DockerService')
const inspect = require('util').inspect

module.exports = Test('DockerService', DockerService)
  .before(async function () {
    this.docker = new Docker()
    await this.docker.leaveSwarm({ force: true })
    const response = await this.docker.initSwarm('[::1]:2377') // must be ipv6 localhost
  })
  .case('node:15-alpine', '[::1]:2377', async function (service) {
    {
      const response = await service.create({
        replicas: 1,
        cmd: ['node', '-e', '"let index = -1; while (index < 1e6) { console.log(++index) }"'],
        workdir: '/opt/heyo',
        env: { HEY: 'hey' },
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
      assert.equal(response.status, 201)
      const body = await response.json()
      this.serviceId = body.ID
    }
    {
      const response = await service.create({
        replicas: 1,
        cmd: ['node', '-e', '"let index = -1; while (index < 1e6) { console.log(++index) }"'],
        workdir: '/opt/heyo',
        env: { HEY: 'hey' },
        mounts: [{
          source: 'other-volume',
          target: '/opt/other-volume',
          readonly: true,
        }],
        memory: 512e6, // bytes
        restart: 'on-failure',

        healthCmd: ['echo', 'ok'],
      })
      assert.equal(response.status, 201)
    }
    {
      const response = await this.docker.listServices()
      assert.equal(response.status, 200)
      const body = await response.json()
      console.log('body', inspect(body, { depth: Infinity }))
    }
  })
  .after(async function () {
    await this.docker.leaveSwarm({ force: true })
  })
