const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerImage = require('./DockerImage')
const pathResolve = require('./internal/pathResolve')

module.exports = Test('DockerImage', DockerImage)
  .before(async function () {
    this.docker = new Docker()
    const response = await this.docker.removeImage('presidium-test:ayo', { force: true })
    assert(response.status == 200 || response.status == 404)
  })
  .case(`
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8888`, {
    tags: ['presidium-test:ayo']
  }, async nodeAlpineImage => {
    const response = await nodeAlpineImage.build(pathResolve(__dirname))
    response.body.pipe(process.stdout)
    await new Promise(resolve => {
      response.body.on('end', () => {
        resolve()
      })
    })
  })
  .after(async function () {
    const response = await this.docker.removeImage('presidium-test:ayo', { force: true })
    assert(response.ok)
    const body = await response.json()
    assert(Array.isArray(body))
  })
