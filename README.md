# Presidium
A library for creating web services.

```javascript
const Presidium = require('presidium')

const {
  HttpServer, WebSocketServer, WebSocket,
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

WebSocketServer(socket => {
  socket.on('message', message => {
    console.log(`received: ${message}`)
  })
  socket.send('something')
}).listen(1337)

const socket = WebSocket('ws://localhost:1337/')
socket.on('open', () => {
  socket.send('something')
})
socket.on('message', data => {
  console.log(data)
})
```
