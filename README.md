# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg)
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
  await myTable.ready

  const myTypeAgeIndex = new DynamoIndex({
    table: 'my-table',
    key: [{ type: 'string' }, { age: 'number' }],
    ...awsCreds,
  })
  await myTypeAgeIndex.ready

  await myTable.putItem({ id: '1', name: 'John', type: 'person' })
  await myTable.updateItem({ id: '1' }, { age: 32 })

  await myTable.putItem({ id: '2', name: 'Joe', age: 19, type: 'person' })
  await myTable.putItem({ id: '3', name: 'Jane', age: 33, type: 'person' })

  const getItemResponse = await myTable.getItem({ id: '1' }),
  console.log(getItemResponse)
  // { Item: { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' } } }

  const jsonItem = await myTable.getItemJSON({ id: '1' })
  console.log(jsonItem)
  // { id: '1', name: 'John', age: 32 }

  const queryResponse = await myTypeAgeIndex.query(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { Limit: 2, ScanIndexForward: true },
  )
  console.log(queryResponse)
  // {
  //   Items: [
  //     { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' }, type: { S: 'person' } },
  //     { id: { S: '2' }, name: { S: 'Joe' }, age: { N: '19' }, type: { S: 'person' } },
  //   ],
  //   Count: 2,
  //   ScannedCount: 2,
  // }

  const iter = myTypeAgeIndex.queryIterator(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { ScanIndexForward: true },
  )
  for await (const item of iter) {
    console.log(item)
    // { id: { S: '2' }, name: { S: 'Joe' }, age: { N: '19' }, type: { S: 'person' } },
    // { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' }, type: { S: 'person' } },
    // { id: { S: '3' }, name: { S: 'Jane' }, age: { N: '33' }, type: { S: 'person' } },
  }

  const jsonIter = myTypeAgeIndex.queryIteratorJSON(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { ScanIndexForward: true },
  )
  for await (const jsonItem of iter) {
    console.log(jsonItem)
    // { id: '2', name: 'Joe', age: 19, type: 'person' }
    // { id: '1', name: 'John', age: 32, type: 'person' }
    // { id: '3', name: 'Jane', age: 33, type: 'person' }
  }
})()
```

## Consume DynamoDB Streams
```javascript
const { DynamoTable, DynamoStream } = require('presidium')

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
  await myTable.ready

  const myStream = new DynamoStream({
    table: 'my-table',
    ...awsCreds,
  })
  await myStream.ready

  for await (const record of myStream) {
    console.log(record)
    // { dynamodb: { NewImage: {...}, OldImage: {...} }, ... }
    // { dynamodb: { NewImage: {...}, OldImage: {...} }, ... }
    // { dynamodb: { NewImage: {...}, OldImage: {...} }, ... }
  }
})()
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

# Support
 * minimum Node.js version: 16
