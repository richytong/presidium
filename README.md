# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

## Serve Http
```javascript
import { HttpServer, Http } from 'presidium'

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

## Serve WebSocket
```javascript
import { WebSocketServer, WebSocket } from 'presidium'

new WebSocketServer(socket => {
  socket.on('message', message => {
    console.log(`received: ${message}`) // received: something from client
    socket.send('something from server')
  })
}).listen(1337)

const socket = new WebSocket('ws://localhost:1337/')
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

const myTable = new DynamoTable('my-table', {
  key: [{ id: 'string' }],
  ...awsCreds,
})

const myIndex = new DynamoIndex('my-index', {
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
```javascript
import { DockerImage } from 'presidium'

const myImage = new DockerImage('my-app:1.0.0', `
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN echo //registry.npmjs.org/:_authToken=${myNpmToken} > $HOME/.npmrc \
  && npm i \
  && rm $HOME/.npmrc
EXPOSE 8080
CMD ["npm", "start"]`)

const buildStream = myImage.build(__dirname, {
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

const container = new DockerContainer('my-container', {
  image: 'node:15-alpine',
  env: { FOO: 'foo' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
})

container.run().pipe(process.stdout) // foo
```

## Deploy Docker Swarm Services
```javascript
import { DockerSwarm, DockerService } from 'presidium'

const mySwarm = new DockerSwarm('my-docker-host.com:2377')
const myService = new DockerService('my-service')

(async function() {
  await mySwarm.join(process.env.SWARM_MANAGER_TOKEN)

  await myService.create({
    image: 'my-app:1.0.0',
    replicas: 1,
    env: { FOO: 'foo', BAR: 'bar' },
    publish: { 8080: 3000 }, // hostPort: containerPort
    restart: 'on-failure',
    healthCmd: ['curl', 'localhost:3000'],
    cmd: ['npm', 'start'],
  })
  await myService.update({
    image: 'my-app:1.0.1',
    replicas: 5,
  })
})()
```
