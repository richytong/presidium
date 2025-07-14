require('rubico/global')
const Transducer = require('rubico/Transducer')
const Test = require('thunk-test')
const assert = require('assert')
const DockerContainer = require('./DockerContainer')
const Docker = require('./Docker')
const identity = require('rubico/x/identity')
const join = require('./internal/join')

const passthrough = target => transform(Transducer.passthrough, target)

const charCode = string => string.charCodeAt(0)

const Stdout = {
  write(...args) {
    console.log(...args)
    return this
  },
}

const test = new Test('DockerContainer', DockerContainer)
  .before(async function () {
    this.docker = new Docker()
    await this.docker.pruneContainers()
    await this.docker.pruneImages()
  })
  .case({
    name: 'test-alpine-1',
    image: 'node:15-alpine',
    env: { FOO: 'foo', BAR: 'bar' },
    cmd: [
      'node',
      '-e',
      `
http.createServer((request, response) => {
  repsonse.end('hello')
}).listen(8080, () => {
  console.log(process.env.FOO)
})`,
    ],
    rm: true
  }, async container => {
    assert.strictEqual(await container.ready, undefined)
    const serverStream = container.run()
    let content = []
    serverStream.on('data', async chunk => {
      content.push(chunk)
      assert.deepEqual(
        await passthrough([])(container.exec(['node', '-e', 'console.log(process.env.BAR)'])),
        [1, 0, 0, 0, 0, 0, 0, 4, charCode('b'), charCode('a'), charCode('r'), charCode('\n')],
      )
      const stopResult = await container.stop()
      assert.equal(stopResult.message, 'success')
      assert.rejects(
        () => container.start(),
        { name: 'Error' })
    })
    await new Promise(resolve => {
      serverStream.on('end', () => {
        content = Buffer.concat(content)
        assert.deepEqual(
          content,
          Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('f'), charCode('o'), charCode('o'), charCode('\n')]))
        resolve()
      })
    })
  })
  .case({
    name: 'test-alpine-2',
    image: 'node:15-alpine',
    env: { FOO: 'foo' },
    cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  }, async container => {
    const logStream = container.run()
    assert.deepEqual(
      await passthrough(Buffer.from(''))(logStream),
      Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('f'), charCode('o'), charCode('o'), charCode('\n')]))
    let startResult = await container.start()
    assert.equal(startResult.message, 'success')
    startResult = await container.start()
    assert.equal(startResult.message, 'container already started')
  })
  .case({
    name: 'test-alpine-2',
    image: 'node:15-alpine',
    env: { FOO: 'foo' },
    cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  }, async container => {
    const logStream = container.run()
    assert.deepEqual(
      await passthrough(Buffer.from(''))(logStream),
      Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('f'), charCode('o'), charCode('o'), charCode('\n')]))
    let startResult = await container.start()
    assert.equal(startResult.message, 'success')
    startResult = await container.start()
    assert.equal(startResult.message, 'container already started')
  })
  .case({
    image: 'node:15-alpine',
    env: { BAR: 'bar' },
    cmd: ['node', '-e', 'console.log(process.env.BAR)'],
  }, async container => {
    const logStream = container.run()
    assert.deepEqual(
      await passthrough(Buffer.from(''))(logStream),
      Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, charCode('b'), charCode('a'), charCode('r'), charCode('\n')]))
    let startResult = await container.start()
    assert.equal(startResult.message, 'success')
    startResult = await container.start()
    assert.equal(startResult.message, 'container already started')
  })
  .after(async function () {
    await this.docker.pruneContainers()
    await this.docker.pruneImages()
  })

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
