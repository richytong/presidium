const HTTP = require('../HTTP')
const Readable = require('../Readable')

// getChromeVersions() -> Promise<{
//   channels: {
//     Stable: { version: string },
//     Beta: { version: string },
//     Dev: { version: string },
//     Canary: { version: string },
//   },
// }>
async function getChromeVersions() {
  const http = new HTTP()
  const response = await http.GET('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json')
  const data = await Readable.JSON(response)
  return data
}

module.exports = getChromeVersions
