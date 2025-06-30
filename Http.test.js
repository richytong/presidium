const assert = require('assert')
const Test = require('thunk-test')
const http = require('http')
const { connect } = require('net')
const Http = require('./Http')
const RequestBuffer = require('./RequestBuffer')

const test1 = new Test('Http GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS, and TRACE', async () => {
  const server = http.createServer(async (request, response) => {
    if (request.url == '/invalid-json') {
      response.write('{"greeting":"Hello Wor')
      response.end()
    } else if (request.url == '/echo') {
      const buffer = await RequestBuffer(request)
      const requestBodyString = buffer.toString('utf8')
      const requestBodyJSON = requestBodyString.length == 0 ? {} : JSON.parse(requestBodyString)
      delete request.headers['content-length']
      response.writeHead(200, {
        'Content-Type': 'application/json',
        ...request.headers,
      })
      response.end(JSON.stringify({ greeting: 'Hello World', ...requestBodyJSON }))
    } else if (request.url == '/echo-binary') {
      const buffer = await RequestBuffer(request)
      delete request.headers['content-length']
      response.writeHead(200, {
        ...request.headers,
      })
      response.end(buffer)
    } else if (request.url == '/echo-text') {
      const buffer = await RequestBuffer(request)
      const text = buffer.toString('utf8')
      delete request.headers['content-length']
      response.writeHead(200, {
        ...request.headers,
      })
      response.end(text)
    }
    else {
      response.writeHead(404, {
        'Content-Type': 'text/plain',
      })
      response.end('Not Found')
    }
  })

  server.listen(3000, () => {
    console.log('server listening on port 3000')
  })

  const _http = new Http('http://localhost:3000/')

  {
    const httpParsedUrl = new Http(new URL('http://localhost:3000/'))
    assert.equal(httpParsedUrl.baseUrl.host, 'localhost:3000')
    assert.equal(httpParsedUrl.baseUrl.protocol, 'http:')
    assert.throws(() => new Http(null), TypeError('baseUrl invalid'))
    const httpUrlToString = new Http({
      toString() {
        return 'http://localhost:3000/'
      }
    })
    assert.equal(httpUrlToString.baseUrl.host, 'localhost:3000')
    assert.equal(httpUrlToString.baseUrl.protocol, 'http:')
    assert.throws(() => new Http(Object.create(null)), TypeError('baseUrl invalid'))
  }

  {
    const response = await _http.get('/echo')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  }

  {
    const response = await _http.get('/invalid-json')
    await assert.rejects(
      response.json(),
      new SyntaxError('Unterminated string in JSON at position 22 (line 1 column 23)'),
    )
    await assert.rejects(
      response.json(),
      new SyntaxError('Unterminated string in JSON at position 22 (line 1 column 23)'),
    )
  }

  {
    const response = await _http.post('/echo', {
      headers: { 'x-test-header': 'testvalue' },
      body: JSON.stringify({ a: 1 }),
    })
    assert.equal(response.headers['x-test-header'], 'testvalue')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
  }

  {
    const response = await _http.post('/echo-binary', {
      headers: {
        'x-test-header': 'testvalue',
        'Content-Type': 'application/octet-stream',
      },
      body: Buffer.from('abc'),
    })
    assert.equal(response.headers['x-test-header'], 'testvalue')
    assert.equal(response.status, 200)
    const data = await response.buffer()
    assert.equal(response.headers['content-type'], 'application/octet-stream')
    assert.deepEqual(Buffer.from(await response.buffer()), Buffer.from('abc'))
  }

  {
    const urlSearchParams = new URLSearchParams()
    urlSearchParams.set('a', 1)
    const response = await _http.post('/echo-text', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-test-header': 'testvalue',
      },
      body: urlSearchParams,
    })
    assert.equal(response.headers['x-test-header'], 'testvalue')
    assert.equal(response.status, 200)
    const data = await response.text()
    assert.equal(response.headers['content-type'], 'application/x-www-form-urlencoded')
    assert.equal(await response.text(), 'a=1')
  }

  await assert.rejects(
    _http.post('/echo-text', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-test-header': 'testvalue',
      },
      body: Object.create(null),
    }),
    new TypeError('body must be one of Buffer, TypedArray, or string'),
  )

  {
    const response = await _http.put('/echo', {
      headers: { 'x-test-header': 'testvalue' },
      body: JSON.stringify({ a: 1 }),
    })
    assert.equal(response.headers['x-test-header'], 'testvalue')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
  }

  {
    const response = await _http.patch('/echo', {
      headers: { 'x-test-header': 'testvalue' },
      body: JSON.stringify({ a: 1 }),
    })
    assert.equal(response.headers['x-test-header'], 'testvalue')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.equal(await response.text(), '{"greeting":"Hello World","a":1}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
    assert.deepEqual(await response.json(), { greeting: 'Hello World', a: 1 })
  }

  {
    const response = await _http.delete('/echo')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  }

  {
    const response = await _http.options('/echo')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  }

  {
    const response = await _http.trace('/echo')
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.equal(response.headers['content-type'], 'application/json')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(Buffer.from(await response.buffer()).toString('utf8'), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.equal(await response.text(), '{"greeting":"Hello World"}')
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
    assert.deepEqual(await response.json(), { greeting: 'Hello World' })
  }

  server.close()
}).case()

const test2 = new Test('HTTP CONNECT', async () => {
  const proxy = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('okay')
  })
  proxy.on('connect', (req, clientSocket, head) => {
    const { port, hostname } = new URL(`http://${req.url}`)
    const serverSocket = connect(port || 80, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                      'Proxy-agent: Node.js-Proxy\r\n' +
                      '\r\n')
      serverSocket.write(head)
      serverSocket.pipe(clientSocket)
      clientSocket.pipe(serverSocket)
    })
  })

  proxy.listen(3001, () => {
    console.log('proxy listening on port 3001')
  })

  const p = new Promise((resolve, reject) => {
    proxy.on('close', resolve)
    proxy.on('error', reject)
  })

  const _http = new Http('http://localhost:3001/')
  const request = _http.connect({ path: 'www.google.com:80' })
  const chunks = []

  request.on('connect', (res, socket, head) => {
    console.log('got connected!')

    // Make a request over an HTTP tunnel
    socket.write('GET / HTTP/1.1\r\n' +
                 'Host: www.google.com:80\r\n' +
                 'Connection: close\r\n' +
                 '\r\n')
    socket.on('data', (chunk) => {
      chunks.push(chunk)
    })
    socket.on('end', () => {
      proxy.close()
    })
  })

  await p

  assert(chunks.length > 0)
  assert(chunks[0].toString('utf8').startsWith('HTTP/1.1 200 OK'))
  proxy.close()
}).case()

const test = Test.all([
  test1,
  test2
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
