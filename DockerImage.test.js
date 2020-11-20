const assert = require('assert')
const Test = require('thunk-test')
const Docker = require('./Docker')
const DockerImage = require('./DockerImage')
const pathResolve = require('./internal/pathResolve')
const pipe = require('rubico/pipe')
const get = require('rubico/get')
const reduce = require('rubico/reduce')

module.exports = Test('DockerImage', DockerImage)
  .before(async function () {
    this.docker = new Docker()
    const response = await this.docker.removeImage('presidium-test:ayo', { force: true })
    assert(response.status == 200 || response.status == 404)
  })
  .case('presidium-test:ayo', async function (dockerImage) {
    {
      const response = await dockerImage.build(pathResolve(__dirname), {
        archive: {
          Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8888`,
        },
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }

    /* {
      const response = await this.docker.auth({
        username: 'admin',
        password: 'password',
        email: 'hey@example.com',
        serveraddress: 'localhost:5000',
      })
      assert.equal(response.status, 200)
      const body = await pipe([
        reduce((a, b) => a + b, ''),
        JSON.parse,
      ])(response.body)
      this.identitytoken = get('IdentityToken')(body)
      assert.equal(this.identitytoken, '')
    } */

    {
      const response = await this.docker.listImages()
      assert.equal(response.status, 200)
      const body = await response.json()
      assert(body.length > 1)
      this.initialBodyLength = body.length
    }
    {
      const response = await this.docker.tagImage('presidium-test:ayo', {
        tag: 'ayo',
        repo: 'localhost:5000/presidium-test',
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await dockerImage.push('localhost:5000', {
        identitytoken: this.identitytoken,
      })
      response.body.pipe(process.stdout)
      await new Promise(resolve => {
        response.body.on('end', resolve)
      })
    }
    {
      const response = await this.docker.inspectImage('localhost:5000/presidium-test:ayo')
      assert.equal(response.status, 200)
    }
  })
  .after(async function () {
    const responses = await Promise.all([
      this.docker.removeImage('presidium-test:ayo'),
      this.docker.removeImage('localhost:5000/presidium-test:ayo'),
    ])
    for (const response of responses) {
      const response = await this.docker.removeImage('presidium-test:ayo')
      assert(response.status == 200 || response.status == 404)
    }
  })
