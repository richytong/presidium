const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerSwarm = require('./DockerSwarm')
const inspect = require('util').inspect

module.exports = Test('DockerSwarm', DockerSwarm)
  .before(async function () {
    this.docker = new Docker()
    await this.docker.leaveSwarm({ force: true })
  })
  .case('[::1]:2377', async function (localSwarm) {
    assert(localSwarm.spec == null)
    assert(localSwarm.version == null)
    await localSwarm.ready
    assert(localSwarm.spec != null)
    assert(localSwarm.version != null)

    {
      const prevTokens = (await localSwarm.inspect()).JoinTokens
      const result = await localSwarm.update({
        rotateWorkerToken: true,
        rotateManagerToken: true,
        rotateManagerUnlockKey: true,
        autolock: true,
      })

      assert.strictEqual(localSwarm.spec.EncryptionConfig.AutoLockManagers, false)
      await localSwarm.ready
      assert.strictEqual(localSwarm.spec.EncryptionConfig.AutoLockManagers, true)
      const newTokens = (await localSwarm.inspect()).JoinTokens
      assert(prevTokens.Worker != newTokens.Worker)
      assert(prevTokens.Manager != newTokens.Manager)
    }

    {
      const result = await localSwarm.update({
        snapshotInterval: 20000,
        keepOldSnapshots: 3,
        logEntriesForSlowFollowers: 1000,
        electionTick: 20,
        heartbeatTick: 2,
      })

      assert.strictEqual(localSwarm.spec.Raft.SnapshotInterval, 10000)
      assert.strictEqual(localSwarm.spec.Raft.KeepOldSnapshots, 0)
      assert.strictEqual(localSwarm.spec.Raft.LogEntriesForSlowFollowers, 500)
      assert.strictEqual(localSwarm.spec.Raft.ElectionTick, 10)
      assert.strictEqual(localSwarm.spec.Raft.HeartbeatTick, 1)
      await localSwarm.ready
      assert.strictEqual(localSwarm.spec.Raft.SnapshotInterval, 20000)
      assert.strictEqual(localSwarm.spec.Raft.KeepOldSnapshots, 3)
      assert.strictEqual(localSwarm.spec.Raft.LogEntriesForSlowFollowers, 1000)
      assert.strictEqual(localSwarm.spec.Raft.ElectionTick, 20)
      assert.strictEqual(localSwarm.spec.Raft.HeartbeatTick, 2)
    }

    {
      const result = await localSwarm.leave({ force: true })
      assert.deepEqual(result, { message: '' })
    }
  })
