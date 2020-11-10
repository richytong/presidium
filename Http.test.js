const assert = require('assert')
const Test = require('thunk-test')
const HttpServer = require('./HttpServer')
const Http = require('./Http')

module.exports = Test('Http', Http)
  .before(function () {
    this.httpServer = HttpServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' })
      switch (request.method) {
        case 'GET': case 'OPTIONS': case 'TRACE': case 'HEAD': {
          response.write(JSON.stringify({ greeting: 'Hello World' }))
          response.end()
          break
        } case 'POST': {
          request.pipe(response)
          break
        } case 'PUT': {
          request.pipe(response)
          break
        } case 'PATCH': {
          request.pipe(response)
          break
        } case 'DELETE': {
          request.pipe(response)
          break
        } default: {
          throw new Error(`unknown request method ${request.method}`)
        }
      }
    }).listen(3000)
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.get('/')
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.post('/', {
      body: JSON.stringify({ a: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { a: 1 })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.put('/', {
      body: JSON.stringify({ a: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { a: 1 })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.delete('/', {
      body: JSON.stringify({ a: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { a: 1 })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.options('/')
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.trace('/')
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  })
  .case('http://localhost:3000/', async helloHttp => {
    const response = await helloHttp.patch('/', {
      body: JSON.stringify({ a: 1 }),
      headers: { 'Content-Type': 'application/json' },
    })
    assert(response.headers.get('content-type') == 'application/json')
    assert.deepEqual(await response.json(), { a: 1 })
  })
  .after(function () {
    this.httpServer.close()
  })
