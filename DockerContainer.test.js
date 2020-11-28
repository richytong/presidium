const Test = require('thunk-test')
const assert = require('assert')
const DockerContainer = require('./DockerContainer')
const Docker = require('./Docker')
const rubico = require('rubico')
const identity = require('rubico/x/identity')
const join = require('./internal/join')

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

const Stdout = {
  write(...args) {
    console.log(...args)
    return this
  },
}

module.exports = Test('DockerContainer', DockerContainer)
  .case('node:15-alpine', {
    env: { FOO: 'foo', BAR: 'bar' },
    cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  }, async container => {
    await new Promise(resolve => {
      const result = container.attach(async dockerStream => {
        const body = await transform(map(identity), Buffer.from(''))(dockerStream)
        assert.deepEqual(
          body,
          Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, 'f'.charCodeAt(0), 'o'.charCodeAt(0), 'o'.charCodeAt(0), '\n'.charCodeAt(0)]))
        resolve()
      }).start()
      assert.strictEqual(result, container)
    })

    await new Promise(resolve => {
      const anotherContainer = DockerContainer.run('node:15-alpine', {
        env: { FOO: 'foo', BAR: 'bar' },
        cmd: ['node', '-e', 'console.log(process.env.BAR)'],
      }, async dockerStream => {
        const body = await transform(map(identity), Buffer.from(''))(dockerStream)
        assert.deepEqual(
          body,
          Buffer.from([1, 0, 0, 0, 0, 0, 0, 4, 'b'.charCodeAt(0), 'a'.charCodeAt(0), 'r'.charCodeAt(0), '\n'.charCodeAt(0)]))
        resolve()
      })
    })
  })
