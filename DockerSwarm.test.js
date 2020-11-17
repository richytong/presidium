const assert = require('assert')
const Test = require('thunk-test')
const fork = require('rubico/fork')
const DockerSwarm = require('./DockerSwarm')

module.exports = Test('DockerSwarm', DockerSwarm)
  .case(swarm => {
    assert.equal(swarm.address, '127.0.0.1:2377')
  })
  .case({ AdvertiseAddr: '127.0.0.1:2378' }, swarm => {
    assert.equal(swarm.address, '127.0.0.1:2378')
  })
  .case('127.0.0.1:2377', async function (swarm) {
    await swarm.leave({ force: true }).catch(() => {})
    assert.equal(typeof await swarm.init(), 'string')
    const swarmInfo = await swarm.inspect()
    assert.equal(typeof swarmInfo.JoinTokens.Worker, 'string')
    assert.equal(typeof swarmInfo.JoinTokens.Manager, 'string')
    assert.rejects(() => swarm.leave(), new Error('You are attempting to leave the swarm on a node that is participating as a manager. Removing the last manager erases all current state of the swarm. Use `--force` to ignore this message. '))
    assert.deepEqual(await swarm.leave({ force: true }), { message: 'Left the swarm successfully.' })
    assert.deepEqual(
      await swarm.join(),
      { message: 'at least 1 RemoteAddr is required to join' })
  })
