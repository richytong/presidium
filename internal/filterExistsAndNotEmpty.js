const filter = require('rubico/filter')
const and = require('rubico/and')
const not = require('rubico/not')
const isEmpty = require('rubico/x/isEmpty')

const exists = value => value != null

const notEmpty = not(isEmpty)

const filterExistsAndNotEmpty = filter(and([exists, notEmpty]))

module.exports = filterExistsAndNotEmpty
