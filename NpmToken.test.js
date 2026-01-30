const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const NpmToken = require('./NpmToken')

const test = new Test('NpmToken', async function integration() {
  await fs.promises.writeFile(`${__dirname}/../.npmrc`, `
//registry.npmjs.org/:_authToken=npm_TESTTOKEN
package-lock=false
  `.trim())

  {
    const npmToken = await NpmToken()
    assert.equal(npmToken, 'npm_TESTTOKEN')
  }

  await fs.promises.rm(`${__dirname}/../.npmrc`)

  await assert.rejects(
    NpmToken({ recurse: false }),
    new Error('Missing .npmrc file')
  )
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
