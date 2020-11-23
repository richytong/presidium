const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')

module.exports = [
  Test('Docker', Docker)
    .case(docker => {
      assert.equal(docker.constructor, Docker)
      assert.equal(new Docker().constructor, Docker)
    })
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
    }),
]
