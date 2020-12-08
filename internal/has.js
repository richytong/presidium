const isObject = require('rubico/x/isObject')

// property string => value any => boolean
const has = property => value => isObject(value) && property in value

module.exports = has
