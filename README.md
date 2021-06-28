# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Handle Http
```javascript
const { HttpServer, Http } = require('presidium')

new HttpServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
}).listen(3000)

const http = new Http('http://localhost:3000/')

http.get('/')
  .then(response => response.json())
  .then(console.log) // { greeting: 'Hello World' }
```

## Handle WebSocket
```javascript
const { WebSocketServer, WebSocket } = require('presidium')

new WebSocketServer(socket => {
  socket.on('message', message => {
    console.log('Got message:', message)
  })
  socket.on('close', () => {
    console.log('Socket closed')
  })
}).listen(1337)


const socket = new WebSocket('ws://localhost:1337/')
socket.addEventListener('open', function (event) {
  socket.send('Hello Server!')
})
socket.addEventListener('message', function (event) {
  console.log('Message from server:', event.data)
})
```

## CRUD and Query DynamoDB
```javascript
const { DynamoTable, DynamoIndex } = require('presidium')

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

;(async function() {
  const myTable = new DynamoTable({
    name: 'my-table',
    key: [{ id: 'string' }],
    ...awsCreds,
  })
  const myIndex = new DynamoIndex({
    table: 'my-table',
    key: [{ name: 'string' }, { age: 'number' }],
    ...awsCreds,
  })
  const myStream = new DynamoStream({
    table: 'my-table',
    ...awsCreds,
  })

  await myTable.ready
  await myIndex.ready
  await myStream.ready

  await myTable.putItem({ id: '1', name: 'George' })
  await myTable.updateItem({ id: '1' }, { age: 32 })
  console.log(
    await myTable.getItem({ id: '1' }),
  ) // { Item: { id: { S: '1' }, ... } }

  console.log(
    await myIndex.query('name = :name AND age < :age', {
      name: 'George',
      age: 33,
    }),
  ) // [{ Items: [{ id: { S: '1' }, ... }, ...] }]

  for await (const record of myStream) {
    console.log(record) // { dynamodb: { NewImage: {...}, OldImage: {...} }, ... }
  }
})()
```

## Consume Kinesis Streams
```javascript
const { KinesisStream } = require('presidium')

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myStream = new KinesisStream({
  name: 'my-stream',
  ...awsCreds,
})

;(async function() {
  await myStream.ready

  await myStream.putRecord('hey')
  await myStream.putRecord('hey')
  await myStream.putRecord('hey')

  for await (const item of myStream) {
    console.log(item) /*
    {
      SequenceNumber: '49614...',
      ApproximateArrivalTimestamp: 2021-01-12T16:01:24.432Z,
      Data: <Buffer ...>, // hey
      PartitionKey: 'hey',
    }
    {
      SequenceNumber: '...',
      SequenceNumber: '49614...',
      ApproximateArrivalTimestamp: 2021-01-12T16:01:24.432Z,
      Data: <Buffer ...>, // hey
      PartitionKey: 'hey',
    }
    {
      SequenceNumber: '49614...',
      ApproximateArrivalTimestamp: 2021-01-12T16:01:24.432Z,
      Data: <Buffer ...>, // hey
      PartitionKey: 'hey',
    }
    */
  }
})
```

## Upload to S3
```javascript
const { S3Bucket } = require('presidium')

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myBucket = new S3Bucket({
  name: 'my-bucket',
  ...awsCreds,
})

;(async function () {
  await myBucket.ready

  await myBucket.putObject('some-key', '{"hello":"world"}', {
    ContentType: 'application/json',
  })
  console.log(
    await myBucket.getObject('some-key'),
  ) // { Etag: ..., Body: '{"hello":"world"}', ContentType: 'application/json' }
  await myBucket.deleteAllObjects()
  await myBucket.delete()
})()
```

## Build and Push Docker Images
> Stop using --build-arg for that npm token
```javascript
const { DockerImage } = require('presidium')

const myImage = new DockerImage('my-app:1.0.0')

const buildStream = myImage.build(__dirname, {
  ignore: ['.github', 'node_modules'],
  archive: {
    Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN echo //registry.npmjs.org/:_authToken=${myNpmToken} > .npmrc \
  && npm i \
  && rm .npmrc
  && rm Dockerfile
EXPOSE 8080
CMD ["npm", "start"]
    `,
  },
})

buildStream.on('end', () => {
  const pushStream = myImage.push('my-registry.io')
  pushStream.pipe(process.stdout)
})
buildStream.pipe(process.stdout)
```

## Execute Docker Containers
```javascript
const { DockerContainer } = require('presidium')

const container = new DockerContainer({
  image: 'node:15-alpine',
  env: { FOO: 'foo' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  rm: true,
})

container.run().pipe(process.stdout) // foo
```

## Deploy Docker Swarm Services
```javascript
const { DockerSwarm, DockerService } = require('presidium')

;(async function() {
  const mySwarm = new DockerSwarm('eth0:2377')
  await mySwarm.ready // initiated new docker swarm

  const myService = new DockerService({
    name: 'my-service',
    image: 'nginx:1.19',
    publish: { 80: 80 },
    healthCheck: ['curl', '[::1]'],
    replicas: 5,
  })
  await myService.ready // new nginx service is up running
})()
```
