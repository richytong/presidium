const pipe = require('rubico/pipe')
const tap = require('rubico/tap')
const map = require('rubico/map')
const get = require('rubico/get')
const switchCase = require('rubico/switchCase')
const forEach = require('rubico/x/forEach')
const glob = require('glob')
const promisify = require('util').promisify

const isArray = Array.isArray

const pathResolve = require('path').resolve

let numTests = 0

map.series(pipe([
  promisify(glob),
  map(pathResolve),
  map(require),
  map.series(switchCase([
    isArray,
    forEach(test => test()),
    test => test(),
  ])),
  forEach(() => {
    numTests += 1
  })
]))(['*.test.js', 'internal/*.test.js']).then(() => {
  console.log(`-- ✅ ${numTests} passing`)
})
