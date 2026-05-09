const Test = require('thunk-test')
const assert = require('assert')
const getChromeUrl = require('./getChromeUrl')
const getChromeVersions = require('./getChromeVersions')

const test = new Test('getChromeUrl', async function integration() {
  const chromeVersions = await getChromeVersions()

  const chromeVersionNumber = chromeVersions.channels.Stable.version
  const platform = 'linux64'
  const url = `https://storage.googleapis.com/chrome-for-testing-public/${chromeVersionNumber}/${platform}/chrome-${platform}.zip`

  assert.equal(await getChromeUrl.call({ chromeVersion: 'stable' }, 'linux64'), url)
  assert.equal(await getChromeUrl.call({ chromeVersion: chromeVersionNumber }, 'linux64'), url)

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
