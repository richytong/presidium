const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerContainer = require('./DockerContainer')
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
        name: 'hey1',
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
      const response = await service.create({
        name: 'hey2',
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
      const response = await this.docker.listServices()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.length, 2)
    }
    {
      const response = await this.docker.inspectService(this.serviceId)
      assert.equal(response.status, 200)
    }
  })
  .after(async function () {
    await this.docker.leaveSwarm({ force: true })
  })
