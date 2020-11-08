# Presidium
A library for creating web services.

```javascript
const Presidium = require('presidium')

const {
  HttpServer, WebSocketServer,
  Dynamo, DynamoTable, DynamoIndex,
  Redis, RedisString, RedisList, RedisSet, RedisHash,
    RedisSortedSet, RedisBitmap, RedisHyperLogLog, RedisStream,
  Kinesis, KinesisStream, KinesisVideo, KinesisVideoStream,
    KinesisFirehose, KinesisFirehoseStream,
  Elasticsearch, ElasticsearchIndex,
  Mongo, MongoTable,
  S3, S3Bucket,
} = Presidium

HttpServer(async (request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json' })
  response.write(JSON.stringify({ greeting: 'Hello World' }))
  response.end()
}).listen(3000)

WebSocketServer(async (socket) => {
  socket.on('message', message => {
    console.log(`received: ${message}`)
  })
  socket.send('something')
}).listen(1337)
```
