const assert = require('assert')
const Test = require('thunk-test')
const get = require('rubico/get')
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
    {
      const response = await swarm.leave({ force: true })
      assert([200, 503].includes(response.status))
    }
    {
      const response = await swarm.init()
      assert.equal(response.status, 200)
    }
    {
      const response = await swarm.inspect()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(typeof body.JoinTokens.Worker, 'string')
      assert.equal(typeof body.JoinTokens.Manager, 'string')
      this.workerJoinToken = body.JoinTokens.Worker
    }
    {
      const response = await swarm.leave()
      assert.equal(response.status, 503)
      assert((await response.json()).message.startsWith('You are attempting to leave'))
    }
    {
      const response = await swarm.leave({ force: true })
      assert.equal(response.status, 200)
    }
    {
      const response = await swarm.join(this.workerJoinToken)
      assert.equal(response.status, 400)
    }
  })
