# Presidium
![presidium](https://rubico.land/assets/presidium-logo-200.jpg)

![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Handle HTTP
```javascript
const { HTTP } = require('presidium')

const server = HTTP.Server((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
})

server.listen(3000)

const http = new HTTP('http://localhost:3000/')

http.get('/')
  .then(response => response.json())
  .then(console.log) // { greeting: 'Hello World' }
```

## Handle WebSocket
```javascript
const { WebSocket } = require('presidium')

const server = new WebSocket.Server(websocket => {
  websocket.on('message', message => {
    console.log('Message from client:', message)
    websocket.send('Hello Client!')
  })
  websocket.on('close', () => {
    console.log('websocket closed')
  })
})
server.listen(1337)

const websocket = new WebSocket('ws://localhost:1337/')
websocket.on('open', () => {
  websocket.send('Hello Server!')
})
websocket.on('message', message => {
  console.log('Message from server:', message)
})
```

## CRUD and Query DynamoDB
```javascript
const { DynamoDB } = require('presidium')

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myTable = new DynamoDB.Table({
  name: 'my-table',
  key: [{ id: 'string' }],
  ...awsCreds,
})
await myTable.ready

const myTypeAgeIndex = new DynamoDB.GlobalSecondaryIndex({
  table: 'my-table',
  key: [{ type: 'string' }, { age: 'number' }],
  ...awsCreds,
})
await myTypeAgeIndex.ready

await myTable.putItem({ id: { S: '1' }, name: { S: 'John' }, type: { S: 'person' } })
await myTable.updateItem({ id: { S: '1' } }, { age: { N: '32' } })

await myTable.putItemJSON({ id: '2', name: 'Joe', age: 19, type: 'person' })
await myTable.putItemJSON({ id: '3', name: 'Jane', age: 33, type: 'person' })

{
  const response = await myTable.getItem({ id: '1' }),
  console.log(response)
  // { Item: { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' } } }
}

{
  const response = await myTable.getItemJSON({ id: '1' })
  console.log(response)
  // { item: { id: '1', name: 'John', age: 32 } }
}

{
  const response = await myTypeAgeIndex.query(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { Limit: 2, ScanIndexForward: true },
  )
  console.log(response)
  // {
  //   Items: [
  //     { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' }, type: { S: 'person' } },
  //     { id: { S: '2' }, name: { S: 'Joe' }, age: { N: '19' }, type: { S: 'person' } },
  //   ],
  //   Count: 2,
  //   ScannedCount: 2,
  // }
}

{
  const ItemIterator = myTypeAgeIndex.queryItemsIterator(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { ScanIndexForward: true },
  )
  for await (const Item of ItemIterator) {
    console.log(Item)
    // { id: { S: '2' }, name: { S: 'Joe' }, age: { N: '19' }, type: { S: 'person' } },
    // { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' }, type: { S: 'person' } },
    // { id: { S: '3' }, name: { S: 'Jane' }, age: { N: '33' }, type: { S: 'person' } },
  }
}

{
  const itemsIterator = myTypeAgeIndex.queryItemsIteratorJSON(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { ScanIndexForward: true },
  )
  for await (const item of itemsIterator) {
    console.log(item)
    // { id: '2', name: 'Joe', age: 19, type: 'person' }
    // { id: '1', name: 'John', age: 32, type: 'person' }
    // { id: '3', name: 'Jane', age: 33, type: 'person' }
  }
}
```

## Consume DynamoDB Streams
```javascript
const { DynamoDB } = require('presidium')

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myTable = new DynamoDB.Table({
  name: 'my-table',
  key: [{ id: 'string' }],
  ...awsCreds,
})
await myTable.ready

const myStream = new DynamoDB.Stream({
  table: 'my-table',
  ...awsCreds,
})
await myStream.ready

for await (const record of myStream) {
  console.log(record)
  // { dynamodb: { NewImage: {...}, OldImage: {...} }, oldImageJSON: {...}, newImageJSON: {...} }
  // { dynamodb: { NewImage: {...}, OldImage: {...} }, oldImageJSON: {...}, newImageJSON: {...} }
  // { dynamodb: { NewImage: {...}, OldImage: {...} }, oldImageJSON: {...}, newImageJSON: {...} }
}
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
await myBucket.ready

await myBucket.putObject('some-key', '{"hello":"world"}', {
  ContentType: 'application/json',
})

{
  const response = await myBucket.getObject('some-key')
  console.log(response) // { Etag: '...', Body: '{"hello":"world"}', ContentType: 'application/json' }
}

await myBucket.deleteAllObjects()
await myBucket.delete()
```

## Build and Push Docker Images
> No more --build-arg for npm tokens!
```javascript
const { Docker } = require('presidium')

const myImage = 'my-app:1.0.0'

const buildStream = await docker.buildImage(myImage, __dirname, {
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

buildStream.pipe(process.stdout)

buildStream.on('end', () => {
  const pushStream = await docker.pushImage(myImage, 'my-registry.io')
  pushStream.pipe(process.stdout)
})
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
const { Docker, DockerService } = require('presidium')

const docker = new Docker()

// initiate docker swarm
await docker.initSwarm('eth0:2377')

const myService = new DockerService({
  name: 'my-service',
  image: 'nginx:1.19',
  publish: { 80: 80 },
  healthCheck: ['curl', '[::1]'],
  replicas: 5,
})
await myService.ready // new nginx service is up running
```

# Support
 * minimum Node.js version: 16
