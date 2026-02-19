const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const { exec } = require('child_process')
const Readable = require('../Readable')
const GoogleChromeForTesting = require('./GoogleChromeForTesting')

const test = new Test('GoogleChromeForTesting', async function integration() {
  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  const cmd = await exec('ps aux | grep "Google Chrome for Testing" | awk \'{print $2}\' | xargs kill', {
    stdio: 'inherit',
  })

  {
    const googleChromeForTesting = new GoogleChromeForTesting({
      userDataDir: `${__dirname}/tmp/chrome`,
      useMockKeychain: true,
    })
    await googleChromeForTesting.init()

    assert.equal(typeof googleChromeForTesting.devtoolsUrl, 'string')
    assert(googleChromeForTesting.devtoolsUrl.startsWith('ws://'))

    googleChromeForTesting.close()
  }

  {
    const googleChromeForTesting = new GoogleChromeForTesting({
      userDataDir: `${__dirname}/tmp/chrome`,
      useMockKeychain: true,
    })
    await googleChromeForTesting.init()

    assert.equal(typeof googleChromeForTesting.devtoolsUrl, 'string')
    assert(googleChromeForTesting.devtoolsUrl.startsWith('ws://'))

    googleChromeForTesting.close()
  }

  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  console.log('Success')
}).case()

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
