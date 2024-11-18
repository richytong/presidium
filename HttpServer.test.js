const Test = require('thunk-test')
const HttpServer = require('./HttpServer')
const http = require('http')
const fetch = require('node-fetch')
const assert = require('assert')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const test = Test('HttpServer', HttpServer)
.case(async (request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.write('hello')
  response.end()
}, async server => {
  server.listen(3001, async () => {
    console.log('Test server listening on port 3001')
  })
  await server.ready

  const response0 = await fetch('http://localhost:3001')
  assert.strictEqual(await response0.text(), 'hello')
  assert.strictEqual(response0.headers.get('content-type'), 'text/plain')
  server.close()
})

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
