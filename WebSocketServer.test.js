const Test = require('thunk-test')
const assert = require('assert')
const fetch = require('node-fetch')
const WebSocket = require('ws')
const WebSocketServer = require('./WebSocketServer')

const test = new Test('WebSocketServer', async function () {
  {
    let didRequest = false

    const server = new WebSocketServer()
    server.listen(7357, () => {
      console.log('server listening on port 7357')
    })
    server.on('request', () => {
      didRequest = true
    })

    assert.throws(
      () => server.on('unknown', () => {}),
      new Error('Unrecognized event unknown')
    )

    const response = await fetch('http://localhost:7357')
    assert(didRequest)
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'OK')
    server.close()
  }

  {
    let resolve
    const promise = new Promise(_resolve => {
      resolve = _resolve
    })

    let didRequest = false
    let didUpgrade = false
    const messages = []

    const server = new WebSocketServer(socket => {
      socket.on('message', message => {
        assert.equal(server.clients.size, 1)
        messages.push(message.toString('utf8'))
        socket.send('pong')
      })

      socket.on('close', () => {
        server.close()
      })
    })

    server.on('request', (...args) => {
      didRequest = true
    })

    server.on('upgrade', () => {
      didUpgrade = true
    })

    server.on('close', resolve)

    server.listen(7357, () => {
      console.log('server listening on port 7357')
    })

    const socket = new WebSocket('ws://localhost:7357')

    socket.addEventListener('message', message => {
      messages.push(message.data)
      socket.close()
    })

    socket.addEventListener('open', () => {
      console.log('WebSocket connection established!')
      socket.send('ping')
    })

    await promise
    assert(!didRequest)
    assert(didUpgrade)
    assert.equal(messages.length, 2)
    assert.equal(messages[0], 'ping')
    assert.equal(messages[1], 'pong')
    server.close()
  }
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
