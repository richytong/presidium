// (from number, to number) => value Array|string => Array|string
const slice = (from, to) => value => value.slice(from, to < 0 ? value.length - to : to)

module.exports = slice
