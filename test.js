const rubico = require('rubico')
const forEach = require('rubico/x/forEach')
const glob = require('glob')
const promisify = require('util').promisify

const {
  pipe, tap,
  switchCase, tryCatch,
  fork, assign, get, set, pick, omit,
  map, filter, reduce, transform, flatMap,
  and, or, not, any, all,
  eq, gt, lt, gte, lte,
  thunkify, always,
  curry, __,
} = rubico

const isArray = Array.isArray

const pathResolve = require('path').resolve

let numTests = 0

map.series(pipe([
  promisify(glob),
  map(curry.arity(1, pathResolve)),
  map(curry.arity(1, require)),
  map.series(switchCase([
    isArray,
    pipe([
      forEach(() => {
        numTests += 1
      }),
      map.series(test => test()),
    ]),
    pipe([
      () => {
        numTests += 1
      },
      test => test(),
    ]),
  ])),
]))(['*.test.js', 'internal/*.test.js']).then(() => {
  console.log(`-- ✅ ${numTests} passing`)
})
