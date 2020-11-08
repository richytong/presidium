const Test = require('thunk-test')
const HttpServer = require('./HttpServer')
const http = require('http')
const fetch = require('node-fetch')
const assert = require('assert')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

module.exports = Test(
  'HttpServer', HttpServer,
).case((request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.write('hello')
  response.end()
}, async server => {
  await new Promise(resolve => {
    server.listen(3000, async () => {
      const response = await fetch('http://localhost:3000')
      assert.strictEqual(await response.text(), 'hello')
      assert.strictEqual(response.headers.get('content-type'), 'text/plain')
      server.close(resolve)
    })
  })
}).case(async (request, response) => {
  await sleep(25)
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.write('hello')
  response.end()
}, async server => {
  await new Promise(resolve => {
    server.listen(3000, async () => {
      const response = await fetch('http://localhost:3000')
      assert.strictEqual(await response.text(), 'hello')
      assert.strictEqual(response.headers.get('content-type'), 'text/plain')
      server.close(resolve)
    })
  })
})
