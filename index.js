const HttpServer = require('./HttpServer')
const WebSocketServer = require('./WebSocketServer')
const RedisSortedSet = require('./RedisSortedSet')

const Presidium = {
  HttpServer, WebSocketServer,
  RedisSortedSet,
}

module.exports = Presidium
