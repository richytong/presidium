# Presidium
![Node.js CI](https://github.com/richytong/presidium/workflows/Node.js%20CI/badge.svg?branch=master)
[![codecov](https://codecov.io/gh/richytong/presidium/branch/master/graph/badge.svg)](https://codecov.io/gh/richytong/presidium)
[![npm version](https://img.shields.io/npm/v/presidium.svg?style=flat)](https://www.npmjs.com/package/presidium)

A library for creating web services.

```javascript
const Presidium = require('presidium')

const {
  Http, HttpServer,
  WebSocket, WebSocketServer,
  Dynamo, DynamoTable, DynamoIndex, DynamoStream,
  Redis, RedisString, RedisList, RedisSet, RedisHash,
    RedisSortedSet, RedisBitmap, RedisHyperLogLog, RedisStream,
  Elasticsearch, ElasticsearchIndex,
  Kinesis, KinesisStream,
  Mongo, MongoTable,
  S3, S3Bucket,
} = Presidium

HttpServer((request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
}).listen(3000)

const http = Http('http://localhost:3000/')

http.get('/')
  .then(response => response.json())
  .then(console.log) // { greeting: 'Hello World' }

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
