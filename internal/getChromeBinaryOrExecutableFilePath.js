// getChromeBinaryOrExecutableFilePath(filepath string, platform string) -> string
function getChromeBinaryOrExecutableFilePath(filepath, platform) {
  if (platform.startsWith('mac') && filepath.endsWith('Google Chrome for Testing')) {
    return filepath
  }
  if (platform.startsWith('linux') && filepath.endsWith('chrome')) {
    return filepath
  }
  if (platform.startsWith('win') && filepath.endsWith('chrome.exe')) {
    return filepath
  }
  return undefined
}

module.exports = getChromeBinaryOrExecutableFilePath
