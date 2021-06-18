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
.case(function emptyHandler(socket) {
}, async function testSocketServerHealthyHttp(server) {
  server.listen(7357, async () => {
    const response = await fetch('http://localhost:7357/')
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'ok')
    server.close()
  })
})
.case(function emptyHandler(socket) {
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
.case(function saveServerMessagesAndCloseHandler(socket) {
  socket.on('message', message => {
    this.serverMessages.push(message)
    socket.send(message)
  })
  socket.on('close', () => {
    this.server.close()
  })
  // START
  socket.send('hello')
}, async function testSocketServerWebSocket(server) {
  this.server = server
  let didOpen = false
  await new Promise(resolve => {
    server.listen(1337, async () => {
      const socket = WebSocket('ws://localhost:1337/')
      socket.on('open', () => {
        didOpen = true
      })
      socket.on('message', message => {
        this.clientMessages.push(message)
        if (this.clientMessages.length == 5) {
          socket.close()
        } else {
          socket.send('world')
        }
      })
      // END
      socket.on('close', resolve)
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
