const Test = require('thunk-test')
const assert = require('assert')
const getPlatform = require('./getPlatform')

const test = new Test('getPlatform', async function integration() {
  const os = require('os')

  const osPlatform = os.platform
  const osArch = os.arch

  os.platform = () => 'darwin'
  os.arch = () => 'x64'

  assert.equal(getPlatform(), 'mac-x64')

  os.platform = () => 'win32'

  assert.equal(getPlatform(), 'win64')

  os.platform = () => 'linux'

  assert.equal(getPlatform(), 'linux64')

  os.platform = osPlatform
  os.arch = osArch

}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
