const fs = require('fs')

// listDiskDevices() -> devices Array<string>
function listDiskDevices() {
  try {
    const devices = fs.readdirSync('/sys/block')
    return devices
  } catch (error) {
    throw new Error('Error reading /sys/block:', error.message)
  }
}

module.exports = listDiskDevices
