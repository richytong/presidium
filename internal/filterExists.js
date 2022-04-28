const filter = require('rubico/filter')

const exists = value => value != null

const filterExists = filter(exists)

module.exports = filterExists
