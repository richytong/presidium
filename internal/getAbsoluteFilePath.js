const path = require('path')

// getAbsoluteFilePath(filepath string, platform string) -> absoluteFilePath string
function getAbsoluteFilePath(filepath, platform) {
  if (platform.startsWith('win')) {
    if (/^[A-Z]:/.test(filepath)) {
      filepath = filepath.replace(/\//g, '\\')
    } else {
      filepath = path.join(process.cwd(), filepath).replace(/\//g, '\\')
    }
  } else if (!filepath.startsWith('/')) {
    filepath = path.join(process.cwd(), filepath)
  }
  return filepath
}

module.exports = getAbsoluteFilePath
