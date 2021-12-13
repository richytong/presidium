const crypto = require('crypto')

// value string => hash string
const sha256 = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex')

module.exports = sha256
