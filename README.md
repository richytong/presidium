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

## Build && Push Docker Images
```javascript
const myAppImage = new DockerImage(`
FROM node:15-alpine
WORKDIR /opt
COPY . .
RUN echo //registry.npmjs.org/:_authToken=${npmToken} > $HOME/.npmrc
  && npm i
  && rm $HOME/.npmrc
CMD ["npm", "start"]
`, { tags: ['my-app:latest'] })
  .build(__dirname, {
  }, buildStream => {
    buildStream.on('end', () => {
      myAppImage.push('my-registry.io', pushStream => {
        pushStream.pipe(process.stdout)
      })
    })
    buildStream.on('error', error => {
      // do stuff with error
    })
    buildStream.pipe(process.stdout)
  })
```

## Execute Docker Containers
```javascript
new DockerContainer('node:15-alpine', {
  env: { FOO: 'foo', BAR: 'bar' },
  cmd: ['node', '-e', 'console.log(process.env.FOO)'],
}).attach(dockerRawStream => {
  dockerRawStream.pipe(process.stdout)
}).start()
```
