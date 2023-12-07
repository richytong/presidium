const assert = require('assert')
const Test = require('thunk-test')
const fetch = require('node-fetch')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('./WebSocket')

const test = Test('WebSocketServer', function (socketHandler, httpHandler) {
  this.clientMessages = []
  this.serverMessages = []
  return WebSocketServer(socketHandler, httpHandler)
})
.case(function emptyHandler(websocket) {
}, async function testSocketServerHealthyHttp(server) {
  server.listen(7357, async () => {
    const response = await fetch('http://localhost:7357/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    server.close()
  })
})
.case(function emptyHandler(websocket) {
}, function customHttpHandler(request, response) {
  response.writeHead(201, {
    'Content-Type': 'text/plain',
  })
  response.end('Created')
}, async function testSocketServerCustomHttp(server) {
  server.listen(7358, async () => {
    const response = await fetch('http://localhost:7358/')
    assert.equal(response.status, 201)
    assert.equal(await response.text(), 'Created')
    server.close()
  })
})
.case(async function testSocketServerNoConstructorHandler(server) {
  server.on('connection', function emptyHandler() {
  })
  server.listen(7359, async () => {
    const response = await fetch('http://localhost:7357/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    server.close()
  })
})
.case(function saveServerMessagesAndCloseHandler(websocket) {
  websocket.on('message', message => {
    this.serverMessages.push(message.toString('utf8'))
    websocket.send(message)
  })
  websocket.on('close', async () => {
    this.server.close()
  })
  // START
  websocket.send('hello')
}, async function testSocketServerWebSocket(server) {
  server.detectAndCloseBrokenConnections({ pingInterval: 50 })
  this.server = server
  let didOpen = false
  await new Promise(resolve => {
    server.listen(1337, async () => {
      const websocket = new WebSocket('ws://localhost:1337/')
      websocket.on('open', () => {
        didOpen = true
      })
      websocket.on('message', async chunk => {
        this.clientMessages.push(chunk.toString('utf8'))
        if (this.clientMessages.length == 5) {
          await new Promise(resolve => setTimeout(resolve, 100)) // wait for a round of detectAndCloseBrokenConnections
          websocket.pong = function noop() {} // overwrite pong to simulate disconnect
          await new Promise(resolve => setTimeout(resolve, 100)) // wait for server to close
        } else {
          websocket.send('world')
        }
      })
      // END
      websocket.on('close', resolve)
    })
  })
  assert(didOpen)
  assert.deepEqual(this.clientMessages, ['hello', 'world', 'world', 'world', 'world'])
  assert.deepEqual(this.serverMessages, ['world', 'world', 'world', 'world'])
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
