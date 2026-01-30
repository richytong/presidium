const package = require('./package.json')

const userAgent = `Presidium/${package.version} Node.js/${process.version.replace('v', '')}`

module.exports = userAgent
