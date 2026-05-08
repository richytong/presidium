const Test = require('thunk-test')
const assert = require('assert')
const retryHTTPRequest = require('./retryHTTPRequest')

const test = new Test('retryHTTPRequest', async function integration() {
  const http1 = {
    async GET(url, options) {
      return 'ok'
    }
  }

  {
    const response = await retryHTTPRequest(http1, 'GET', '/test', {})
    assert.equal(response, 'ok')
  }

  let retries = 0
  const http2 = {
    async GET(url, options) {
      if (retries === 0) {
        retries += 1
        throw new Error('test')
      }
      return 'ok'
    }
  }

  {
    const response = await retryHTTPRequest(http2, 'GET', '/test', {})
    assert.equal(response, 'ok')
    assert.strictEqual(retries, 1)
  }

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
