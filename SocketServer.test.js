const Test = require('thunk-test')
const SocketServer = require('./SocketServer')
const engine = require('engine.io/lib/engine.io')

Test('SocketServer', SocketServer)
  .case((socket) => {
    socket.send('hello')
  }, async server => {
    await new Promise(resolve => {
      server.listen(1337, () => {
        console.log(new engine.Socket('ws://localhost:1337/'))
        server.close(resolve)
      })
    })
  })()
