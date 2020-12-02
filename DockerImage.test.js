const Test = require('thunk-test')
const assert = require('assert')
const DockerImage = require('./DockerImage')
const Docker = require('./Docker')
const rubico = require('rubico')
const identity = require('rubico/x/identity')
const join = require('./internal/join')
const Http = require('./Http')

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

const passthrough = target => transform(map(identity), target)

const charCode = string => string.charCodeAt(0)

module.exports = Test('DockerImage', DockerImage).case('my-image:hello', `
FROM node:15-alpine
WORKDIR /opt
COPY . .
EXPOSE 8080`, async function (myImage) {
  const buildStream = myImage.build(__dirname)
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
FROM busybox:1.32
WORKDIR /opt
COPY . .
EXPOSE 8081
`, async function (myImage) {
  const buildStream = myImage.build(__dirname)
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
})()
