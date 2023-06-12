require('rubico/global')
const Transducer = require('rubico/Transducer')
const Test = require('thunk-test')
const assert = require('assert')
const DockerImage = require('./DockerImage')
const Docker = require('./Docker')
const identity = require('rubico/x/identity')
const join = require('./internal/join')
const Http = require('./Http')

const passthrough = target => transform(Transducer.passthrough, target)

const charCode = string => string.charCodeAt(0)

const test = new Test('DockerImage', DockerImage)
  .case('doesnot:exist', async function (dneImage) {
    const data = await dneImage.inspect()
    assert(data.message.startsWith('No such image'))
  })
  .case('node:15-alpine', async function (alpineImage) {
    {
      const pullStream = alpineImage.pull()
      pullStream.pipe(process.stdout)
      await new Promise(resolve => pullStream.on('end', resolve))
    }
    {
      const data = await alpineImage.inspect()
      assert(data.RepoTags.includes('node:15-alpine'))
    }
    {
      const pullStream = alpineImage.pull({ identitytoken: '' })
      pullStream.pipe(process.stdout)
      await new Promise(resolve => pullStream.on('end', resolve))
    }
  })
  .case('my-image:hello', async function (myImage) {
    const buildStream = myImage.build(__dirname, {
      archive: {
        Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8080
        `,
      },
    })
    await passthrough(process.stdout)(buildStream)
    const pushStream = myImage.push('localhost:5000')
    await passthrough(process.stdout)(pushStream)
    const myImageInspection = await myImage.inspect()
    assert.deepEqual(
      myImageInspection.RepoTags,
      ['my-image:hello', 'localhost:5000/my-image:hello'])
    this.docker = myImage.docker
  })
  .case('my-image:hey', `
  `, async function (myImage) {
    const buildStream = myImage.build(__dirname, {
      archive: {
        Dockerfile: `
FROM busybox:1.32
WORKDIR /opt
COPY . .
EXPOSE 8081
        `,
      },
      platform: 'linux/x86_64',
    })
    buildStream.pipe(process.stdout)
    await buildStream.promise
    const pushStream = myImage.push('localhost:5000')
    pushStream.pipe(process.stdout)
    await pushStream.promise
    const myImageInspection = await myImage.inspect()
    assert.deepEqual(
      myImageInspection.RepoTags,
      ['my-image:hey', 'localhost:5000/my-image:hey'])
  })
.after(async function () {
  await this.docker.pruneContainers()
  await this.docker.pruneImages()
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
