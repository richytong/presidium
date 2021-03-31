const assert = require('assert')
const Test = require('thunk-test')
const RequestBuffer = require('./RequestBuffer')
const { Readable } = require('stream')
const Http = require('./Http')
const HttpServer = require('./HttpServer')

const test = new Test('RequestBuffer', async function() {
  const testServer = new HttpServer(async (request, response) => {
    const buffer = await RequestBuffer(request)
    response.end(buffer.toString('utf8'))
  }).listen(7357, () => {
    console.log('testServer listening on port 7357')
  })
  const testHttp = new Http('http://localhost:7357')

  {
    const response = await testHttp.post('/', {
      headers: {
        'Content-Type': 'image/png',
      },
      body: Buffer.from('hello world')
    })
    assert.strictEqual(await response.text(), 'hello world')
  }

  testServer.close()
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
