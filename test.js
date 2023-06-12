require('rubico/global')
const x = require('rubico/x')
const glob = require('glob')
const promisify = require('util').promisify

const pglob = curry.arity(1, promisify(glob))

pipe(['*.test.js', 'internal/*.test.js'], [
  flatMap(pglob),
  async function runTestFiles(filepaths) {
    for (const filepath of filepaths) {
      console.log(filepath)
      const test = require(`./${filepath}`)
      await test()
    }
    console.log(`-- ✅ ${filepaths.length} passing`)
  },
])
