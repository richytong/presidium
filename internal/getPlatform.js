const os = require('os')

// getPlatform() -> platform string
function getPlatform() {
  let platform = os.platform()
  if (platform == 'darwin') {
    platform = 'mac'
  }
  const arch = os.arch()

  if (platform == 'mac') {
    platform = `${platform}-${arch}`
  } else if (platform == 'win32') {
    platform = `win${arch.slice(1)}`
  } else {
    platform = `${platform}${arch.slice(1)}`
  }

  return platform
}

module.exports = getPlatform
