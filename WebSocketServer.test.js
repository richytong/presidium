const assert = require('assert')
const Test = require('thunk-test')
const WebSocketServer = require('./WebSocketServer')
const WebSocket = require('ws')

module.exports = Test('WebSocketServer', function (socketHandler) {
  this.clientMessages = []
  this.serverMessages = []
  return WebSocketServer(socketHandler)
}).case(function socketHandler(socket) {
  socket.on('message', message => {
    this.serverMessages.push(message)
    socket.send(message)
  })
  socket.on('close', () => {
    this.server.close()
  })
  // START
  socket.send('hello')
}, async function tester(server) {
  this.server = server
  let didOpen = false
  await new Promise(resolve => {
    server.listen(1337, async () => {
      const socket = new WebSocket('ws://localhost:1337/')
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
