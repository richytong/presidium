const Test = require('thunk-test')
const assert = require('assert')
const fs = require('fs')
const { exec, spawn } = require('child_process')
const Readable = require('./Readable')
const sleep = require('./internal/sleep')
const GoogleChromeForTesting = require('./GoogleChromeForTesting')

const test1 = new Test('GoogleChromeForTesting', async function integration1() {

  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  await exec('ps aux | grep "Google Chrome for Testing" | awk \'{print $2}\' | xargs kill', {
    stdio: 'inherit',
  })

  {
    const googleChromeForTesting = new GoogleChromeForTesting()
    assert.equal(googleChromeForTesting.chromeVersion, 'stable')
    assert.equal(googleChromeForTesting.chromeDir, `google-chrome-for-testing`)
    assert.equal(googleChromeForTesting.remoteDebuggingPort, 9222)
    assert.equal(googleChromeForTesting.headless, false)
    assert.equal(googleChromeForTesting.userDataDir, 'tmp/chrome')
    assert.equal(googleChromeForTesting.useMockKeychain, true)
  }

  {
    const googleChromeForTesting = new GoogleChromeForTesting({
      chromeVersion: 'stable',
      chromeDir: `${__dirname}/google-chrome-for-testing`,
      remoteDebuggingPort: 9222,
      headless: true,
      userDataDir: `${__dirname}/tmp/chrome`,
      useMockKeychain: true,
    })
    assert.equal(googleChromeForTesting.chromeVersion, 'stable')
    assert.equal(googleChromeForTesting.chromeDir, `${__dirname}/google-chrome-for-testing`)
    assert.equal(googleChromeForTesting.remoteDebuggingPort, 9222)
    assert.equal(googleChromeForTesting.headless, true)
    assert.equal(googleChromeForTesting.userDataDir, `${__dirname}/tmp/chrome`)
    assert.equal(googleChromeForTesting.useMockKeychain, true)
  }

  {
    const googleChromeForTesting = new GoogleChromeForTesting({
      chromeDir: `${__dirname}/google-chrome-for-testing`,
      userDataDir: `${__dirname}/tmp/chrome`,
      headless: true,
    })

    assert.strictEqual(googleChromeForTesting.devtoolsUrl, undefined)
    await googleChromeForTesting.init()
    assert.equal(typeof googleChromeForTesting.devtoolsUrl, 'string')
    await googleChromeForTesting.init()

    const p = new Promise(resolve => {
      googleChromeForTesting.on('error', resolve)
    })
    googleChromeForTesting.cmd.emit('error', new Error('test'))
    const caughtError = await p
    assert.equal(caughtError.message, 'test')

    assert.equal(typeof googleChromeForTesting.devtoolsUrl, 'string')
    assert(googleChromeForTesting.devtoolsUrl.startsWith('ws://'))

    let closeResolve
    const closePromise = new Promise(_resolve => {
      closeResolve = _resolve
    })
    googleChromeForTesting.cmd.on('close', () => {
      closeResolve()
    })

    googleChromeForTesting.close()

    await closePromise
  }

  {
    const cmd = spawn('node', ['testRunGoogleChromeForTesting.js'], { stdio: 'inherit' })

    const p = new Promise(resolve => {
      cmd.on('exit', resolve)
    })

    await sleep(5000).then(() => {
      cmd.kill('SIGTERM')
    })

    await p
  }

  {
    const googleChromeForTesting = new GoogleChromeForTesting({
      chromeDir: `${__dirname}/google-chrome-for-testing`,
      userDataDir: `${__dirname}/tmp/chrome`,
      headless: true,
    })
    await googleChromeForTesting.init()

    assert.equal(typeof googleChromeForTesting.devtoolsUrl, 'string')
    assert(googleChromeForTesting.devtoolsUrl.startsWith('ws://'))

    await fs.promises.rm(googleChromeForTesting.cmd.spawnargs[0])
    googleChromeForTesting.devtoolsUrl = undefined

    await assert.rejects(
      googleChromeForTesting.init(),
      new Error('chrome binary or executable not found.')
    )

    let closeResolve
    const closePromise = new Promise(_resolve => {
      closeResolve = _resolve
    })
    googleChromeForTesting.cmd.on('close', () => {
      closeResolve()
    })

    googleChromeForTesting.close()

    await closePromise
  }

  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  console.log('Success')
}).case()

const test2 = new Test('GoogleChromeForTesting', async function integration2() {

  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  await exec('ps aux | grep "Google Chrome for Testing" | awk \'{print $2}\' | xargs kill', {
    stdio: 'inherit',
  })

  {
    const cmd = spawn('node', ['testRunGoogleChromeForTesting.js'], { stdio: 'inherit' })

    const p = new Promise(resolve => {
      cmd.on('exit', resolve)
    })

    await sleep(5000).then(() => {
      cmd.kill()
    })

    await p
  }

  {
    const cmd = spawn('node', ['testRunGoogleChromeForTesting.js'], { stdio: 'pipe' })

    const p = new Promise(resolve => {
      cmd.on('exit', resolve)
    })

    await sleep(5000).then(() => {
      cmd.kill()
    })

    await p
  }

  await fs.promises.rm('google-chrome-for-testing', { recursive: true, force: true })

  console.log('Success')
}).case()

const test = Test.all([
  test1,
  test2,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
