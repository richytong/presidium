const util = require('util')

// value any -> representation string
const inspect = value => util.inspect(value, { depth: Infinity })

module.exports = inspect
