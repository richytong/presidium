// getPhysicalSectorSize(device string) -> number
function getPhysicalSectorSize(device) {
  try {
    const path = `/sys/block/${device}/queue/physical_block_size`
    const size = fs.readFileSync(path, 'utf8')
    return parseInt(size.trim(), 10)
  } catch (error) {
    throw new Error('Could not read sector size:', error.message)
  }
}

module.exports = getPhysicalSectorSize
