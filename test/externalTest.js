const WebSocket = require('../WebSocket')
const assert = require('assert')

/**
 * @name main
 *
 * @docs
 * main() -> ()
 */
async function main() {
  const websocket = new WebSocket('wss://echo.websocket.org/')

  let resolve
  const promise = new Promise(_resolve => {
    resolve = _resolve
  })

  websocket.on('open', () => {
    websocket.send('test')
  })

  const messages = []

  websocket.on('message', message => {
    messages.push(message)
    if (messages.length == 2) {
      resolve()
      websocket.close()
    }
  })

  await promise

  assert.equal(messages.length, 2)
  assert.equal(messages[1].toString('utf8'), 'test')
}

main()
