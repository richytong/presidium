const sleep = require('./sleep')

// retryHTTPRequest(http HTTP, method string, url string, options {
//   headers: Object<string>,
//   body: string,
// }) -> http.ServerResponse
async function retryHTTPRequest(http, method, url, options) {
  try {
    const response = await http[method](url, options)
    return response
  } catch {
    await sleep(1000)
    return retryHTTPRequest(http, method, url, options)
  }
}

module.exports = retryHTTPRequest
