require('rubico/global')
const glob = require('glob')
const promisify = require('util').promisify

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
