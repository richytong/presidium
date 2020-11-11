const pipe = require('rubico/pipe')
const slice = require('./slice')
const stringifyJSON = require('./stringifyJSON')
const sha256 = require('./sha256')

// json Object => hash string
const hashJSON = pipe([
  stringifyJSON,
  sha256,
  slice(0, 32),
])

module.exports = hashJSON
