# Presidium
![presidium](https://rubico.land/assets/presidium-logo-3-w200.jpg)

![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Installation
with [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm):
```bash
npm i presidium
```

require Presidium in [CommonJS](https://nodejs.org/docs/latest/api/modules.html#modules-commonjs-modules):
```javascript
// import Presidium globally
require('presidium/global')

// import Presidium
const presidium = require('presidium')

// import Presidium clients
const DynamoDBTable = require('presidium/DynamoDBTable')
const S3Bucket = require('presidium/S3Bucket')
const WebSocket = require('presidium/WebSocket')
const Readable = require('presidium/Readable')
```

## Handle HTTP
```javascript
const HTTP = require('presidium/HTTP')

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
const WebSocket = require('presidium/WebSocket')

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
const DynamoDBTable = require('presidium/DynamoDBTable')
const DynamoDBGlobalSecondaryIndex = require('presidium/DynamoDBGlobalSecondaryIndex')
const AwsCredentials = require('presidium/AwsCredentials')

const awsCreds = await AwsCredentials('default')
awsCreds.region = 'us-east-1'

const myTable = new DynamoDBTable({
  name: 'my-table',
  key: [{ id: 'string' }],
  ...awsCreds,
})
await myTable.ready

const myTypeAgeIndex = new DynamoDBGlobalSecondaryIndex({
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
  const data = await myTable.getItem({ id: { S: '1' } }),
  console.log(data)
  // { Item: { id: { S: '1' }, name: { S: 'John' }, age: { N: '32' } } }
}

{
  const data = await myTable.getItemJSON({ id: '1' })
  console.log(data)
  // { item: { id: '1', name: 'John', age: 32 } }
}

{
  const data = await myTypeAgeIndex.query(
    'type = :type AND age < :age',
    { type: { S: 'person' }, age: { N: '100' } },
    { Limit: 2, ScanIndexForward: true },
  )
  console.log(data)
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
  const data = await myTypeAgeIndex.queryJSON(
    'type = :type AND age < :age',
    { type: 'person', age: 100 },
    { Limit: 2, ScanIndexForward: true },
  )
  console.log(data)
  // {
  //   ItemsJSON: [
  //     { id: '1', name: 'John', age: 32, type: 'person' },
  //     { id: '2', name: 'Joe', age: 19, type: 'person' },
  //   ],
  //   Count: 2,
  //   ScannedCount: 2,
  // }
}

{
  const ItemIterator = myTypeAgeIndex.queryItemsIterator(
    'type = :type AND age < :age',
    { type: { S: 'person' }, age: { N: '100' } },
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
const DynamoDBTable = require('presidium/DynamoDBTable')
const DynamoDBStream = require('presidium/DynamoDBStream')
const AwsCredentials = require('presidium/AwsCredentials')

const awsCreds = await AwsCredentials('default')
awsCreds.region = 'us-east-1'

const myTable = new DynamoDBTable({
  name: 'my-table',
  key: [{ id: 'string' }],
  ...awsCreds,
})
await myTable.ready

const myStream = new DynamoDBStream({
  table: 'my-table',
  ...awsCreds,
})
await myStream.ready

for await (const record of myStream) {
  console.log(record)
  // { dynamodb: { Keys: {...}, NewImage: {...}, OldImage: {...} }  }
  // { dynamodb: { Keys: {...}, NewImage: {...}, OldImage: {...} }  }
  // { dynamodb: { Keys: {...}, NewImage: {...}, OldImage: {...} }  }
}

const myStreamJSON = new DynamoDBStream({
  table: 'my-table',
  ...awsCreds,
  JSON: true,
})
await myStream.ready

for await (const record of myStreamJSON) {
  console.log(record)
  // { dynamodb: { KeysJSON: {...}, NewImageJSON: {...}, OldImageJSON: {...} }  }
  // { dynamodb: { KeysJSON: {...}, NewImageJSON: {...}, OldImageJSON: {...} }  }
  // { dynamodb: { KeysJSON: {...}, NewImageJSON: {...}, OldImageJSON: {...} }  }
}
```

## Upload to S3
```javascript
const S3Bucket = require('presidium/S3Bucket')
const AwsCredentials = require('presidium/AwsCredentials')

const awsCreds = await AwsCredentials('default')
awsCreds.region = 'us-east-1'

const myBucket = new S3Bucket({
  name: 'my-bucket',
  ...awsCreds,
})
await myBucket.ready

await myBucket.putObject('some-key', '{"hello":"world"}', {
  ContentType: 'application/json',
})

const data = await myBucket.getObject('some-key')
console.log(data)
// { Etag: '...', Body: <Buffer 7b 22 68 ...>, ContentType: 'application/json' }

await myBucket.deleteAllObjects()
await myBucket.delete()
```

## Build and Push Docker Images
> No more --build-arg for npm tokens!
```javascript
const Docker = require('presidium/Docker')
const NpmToken = require('presidium/NpmToken')
const fs = require('fs')

const myImage = 'my-app:1.0.0'

const npmrc = fs.createWriteStream('.npmrc')
npmrc.write(`//registry.npmjs.org/:_authToken=${await NpmToken()}`)
npmrc.end()

const buildStream = await docker.buildImage(__dirname, {
  image: myImage,
  ignore: ['.github', 'node_modules'],
  archive: {
    Dockerfile: `
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN npm i \
  && rm .npmrc \
  && rm Dockerfile
EXPOSE 8080
CMD ["npm", "start"]
    `,
  },
})

buildStream.pipe(process.stdout)
await new Promise(resolve => buildStream.on('end', resolve))

const pushStream = await docker.pushImage({
  image: myImage,
  repository: 'my-registry.io',
})
pushStream.pipe(process.stdout)
```

## Run Docker Containers
```javascript
const Docker = require('presidium/Docker')

const docker = new Docker()

const runStream = await docker.runContainer({
  image: 'node:15-alpine',
  env: { FOO: 'Example' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
  rm: true,
})

runStream.pipe(process.stdout) // Example
```

## Deploy Docker Swarm Services
```javascript
const Docker = require('presidium/Docker')

const docker = new Docker()

// initialize docker swarm
await docker.initSwarm('eth0:2377')

await docker.createService({
  name: 'my-service',
  image: 'nginx:1.19',
  publish: { 80: 80 },
  healthCheck: ['curl', '[::1]'],
  replicas: 5,
})
// new nginx service is deploying to the docker swarm
```

# Support
 * minimum Node.js version: 16
