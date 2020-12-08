# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Serve Http
```javascript
import { HttpServer, Http } from 'presidium'

HttpServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
}).listen(3000)

const http = Http('http://localhost:3000/')

http.get('/')
  .then(response => response.json())
  .then(console.log) // { greeting: 'Hello World' }
```

## Serve WebSocket
```javascript
import { WebSocketServer, WebSocket } from 'presidium'

WebSocketServer(socket => {
  socket.on('message', message => {
    console.log(`received: ${message}`) // received: something from client
    socket.send('something from server')
  })
}).listen(1337)

const socket = WebSocket('ws://localhost:1337/')
socket.on('open', () => {
  socket.send('something from client')
})
socket.on('message', data => {
  console.log(data) // something from server
})
```

## CRUD and Query DynamoDB
```javascript
import { DynamoTable, DynamoIndex } from 'presidium'

const awsCreds = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
}

const myTable = DynamoTable('my-table', {
  key: [{ id: 'string' }],
  ...awsCreds,
})

const myIndex = DynamoIndex('my-index', {
  key: [{ name: 'string' }, { age: 'number' }],
  table: 'my-table',
  ...awsCreds,
})

(async function() {
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
  await myTable.deleteItem({ id: '1' })
})()
```

## Build and Push Docker Images
> Stop using --build-arg for that npm token
```javascript
import { DockerImage } from 'presidium'

const myImage = DockerImage(`
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN echo //registry.npmjs.org/:_authToken=${myNpmToken} > $HOME/.npmrc \
  && npm i \
  && rm $HOME/.npmrc
EXPOSE 8080
CMD ["npm", "start"]`)

const buildStream = myImage.build(__dirname, {
  tags: ['my-app:1.0.0'],
  ignore: ['.github', 'node_modules'],
})
buildStream.on('end', () => {
  const pushStream = myImage.push('my-registry.io')
  pushStream.pipe(process.stdout)
})
buildStream.pipe(process.stdout)
```

## Execute Docker Containers
```javascript
import { DockerContainer } from 'presidium'

const container = DockerContainer({
  image: 'node:15-alpine',
  env: { FOO: 'foo' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
})

container.run().pipe(process.stdout) // foo
```

## Deploy Docker Swarm Services
```javascript
import { DockerSwarm, DockerService } from 'presidium'

(async function() {
  const mySwarm = DockerSwarm('192.168.99.121:2377')

  await mySwarm.ready

  const myService = DockerService({
    name: 'my-service',
    image: 'nginx:1.19',
    publish: { 8080: 80 },
    healthCheck: ['curl', '0.0.0.0:80'],
    replicas: 1,
  })

  await myService.update({ replicas: 5 })
})()
```
