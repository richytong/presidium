const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerSwarm = require('./DockerSwarm')
const inspect = require('util').inspect

const test = Test('DockerSwarm', async function () {
  this.docker = new Docker()
  await this.docker.leaveSwarm({ force: true })

  const advertiseAddr = '[::1]:2377'
  const localSwarm = new DockerSwarm(advertiseAddr)

  console.log('initializing swarm')
  await localSwarm.init()

  await localSwarm.inspect().then(console.log)

  {
    console.log('leaving swarm')
    const result = await localSwarm.leave({ force: true })
    assert.deepEqual(result, { message: '' })
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
