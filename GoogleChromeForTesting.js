/**
 * Presidium
 * https://presidium.services/
 * (c) Richard Tong
 * Presidium may be freely distributed under the CFOSS license.
 */

const https = require('https')
const EventEmitter = require('events')
const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')
const extract = require('extract-zip')
const HTTP = require('./HTTP')
const XML = require('./XML')
const Readable = require('./Readable')
const getPlatform = require('./internal/getPlatform')
const walk = require('./internal/walk')
const sleep = require('./internal/sleep')
const getChromeUrl = require('./internal/getChromeUrl')
const getAbsoluteFilePath = require('./internal/getAbsoluteFilePath')
const getChromeBinaryOrExecutableFilePath = require('./internal/getChromeBinaryOrExecutableFilePath')

async function installChrome() {
  const platform = getPlatform()
  const url = await getChromeUrl.call(this, platform)

  let filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`
  filepath = getAbsoluteFilePath(filepath, platform)

  const delimiter = platform.startsWith('win') ? '\\' : '/'
  const parentDir = `${filepath.split(delimiter).slice(0, -1).join(delimiter)}`

  await fs.promises.mkdir(parentDir, { recursive: true })

  const http = new HTTP()
  const response = await http.GET(url)
  const contentLength = response.headers['content-length']

  await fs.promises.mkdir(parentDir, { recursive: true })
  const fileStream = fs.createWriteStream(filepath)
  // response.pipe(fileStream)

  let downloadedLength = 0
  response.on('data', chunk => {
    downloadedLength += chunk.length
    if (downloadedLength == contentLength) {
      console.log(`Downloading ${url} (${downloadedLength} / ${contentLength} bytes)\n`, platform)
    } else {
      console.log(`Downloading ${url} (${downloadedLength} / ${contentLength} bytes)`, platform)
    }

    fileStream.write(chunk)
  })

  response.on('end', () => {
    fileStream.end()
  })

  let resolve
  const promise = new Promise(_resolve => {
    resolve = _resolve
  })
  fileStream.on('finish', () => {
    resolve()
  })
  await promise

  console.log('Extracting', filepath)
  await extract(filepath, { dir: parentDir })
}

async function getChromeFilepath() {
  const platform = getPlatform()
  const url = await getChromeUrl.call(this, platform)
  const filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`
  const parentDir = `${filepath.split('/').slice(0, -1).join('/')}`

  try {
    const dirents = await fs.promises.readdir(parentDir)
    if (dirents.length <= 1) {
      await installChrome.call(this)
    }

    for await (const filepath of walk(parentDir)) {
      const chromeBinaryOrExecutableFilePath =
        getChromeBinaryOrExecutableFilePath(filepath, platform)
      if (chromeBinaryOrExecutableFilePath) {
        return chromeBinaryOrExecutableFilePath
      }
    }
    throw new Error('chrome binary or executable not found.')
  } catch (error) {
    if (error.code == 'ENOENT') {
      await installChrome.call(this)
      const filepath = await getChromeFilepath.call(this)
      return filepath
    }
    throw error
  }
}

/**
 * @name GoogleChromeForTesting
 *
 * @docs
 * ```coffeescript [specscript]
 * new GoogleChromeForTesting(options {
 *   chromeVersion: 'stable'|'beta'|'dev'|'canary'|string,
 *   remoteDebuggingPort: number,
 *   headless: boolean,
 *   userDataDir: string,
 *   useMockKeychain: boolean,
 * }) -> googleChromeForTesting GoogleChromeForTesting
 * ```
 *
 * Presidium GoogleChromeForTesting client for test automation.
 *
 * Arguments:
 *   * `options`
 *     * `chromeVersion` - the version of Google Chrome for Testing to download. Defaults to `'stable'`.
 *     * `chromeDir` - the directory that Google Chrome for Testing will install to. Defaults to ``google-chrome-for-testing'`.
 *     * `remoteDebuggingPort` - the port that the Chrome DevTools Protocol server will listen on. Defaults to `9222`
 *     * `headless` - whether to run Google Chrome for Testing in headless mode. Defaults to `false`.
 *     * `userDataDir` - directory for storing user profile data such as history, bookmarks, cookies, and settings. Defaults to `tmp/chrome`.
 *     * `useMockKeychain` - whether to use a mock keychain instead of the system's real security keychain. Defaults to `true`.
 *
 * Returns:
 *   * `googleChromeForTesting` - an instance of the `GoogleChromeForTesting` client.
 *
 * ```javascript
 * const googleChromeForTesting = new GoogleChromeForTesting({ chromeVersion: 'stable' })
 * await googleChromeForTesting.init()
 * ```
 *
 * Google Chrome for Testing versions:
 *   * [Chrome for Testing availability](https://googlechromelabs.github.io/chrome-for-testing/)
 *
 * Supported platforms:
 *   * MacOS (64-bit)
 *   * Linux (64-bit)
 *   * Windows (64-bit)
 *
 * ## Further Installation
 * Some further installation may be required for Linux platforms.
 *
 * ### Install headless dependencies for Amazon Linux 2023 / Red Hat
 * ```sh
 * sudo dnf install -y cairo pango nss nspr atk at-spi2-atk cups-libs libdrm libxkbcommon libXcomposite libXdamage libXfixes libXrandr mesa-libgbm alsa-lib
 * ```
 *
 * ### Install headless dependencies for Ubuntu / Debian
 * ```sh
 * sudo apt-get update && sudo apt-get install -y libcairo2 libpango-1.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdrm-dev libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm-dev libasound2-dev
 * ```
 */
class GoogleChromeForTesting extends EventEmitter {
  constructor(options = {}) {
    super()
    this.chromeVersion = options.chromeVersion ?? 'stable'
    this.chromeDir = options.chromeDir ?? 'google-chrome-for-testing'
    this.remoteDebuggingPort = options.remoteDebuggingPort ?? 9222
    this.headless = options.headless ?? false
    this.userDataDir = options.userDataDir ?? 'tmp/chrome'
    this.useMockKeychain = options.useMockKeychain ?? true
    this.devtoolsUrl = undefined
  }

  /**
   * @name init
   *
   * @docs
   * ```coffeescript [specscript]
   * init() -> Promise<>
   * ```
   *
   * Initializes the `GoogleChromeForTesting` client.
   *
   * Arguments:
   *   * (none)
   *
   * Returns:
   *   * `promise` - a promise that resolves when the initialization process is done.
   *
   * ```javascript
   * const googleChromeForTesting = new GoogleChromeForTesting()
   *
   * await googleChromeForTesting.init()
   * ```
   */
  async init() {
    if (this.devtoolsUrl) {
      return undefined
    }

    const chromeFilepath = await getChromeFilepath.call(this)

    const cmd = spawn(chromeFilepath, [
      `--remote-debugging-port=${this.remoteDebuggingPort}`,
      `--user-data-dir=${this.userDataDir}`,
      ...this.headless ? ['--headless'] : [],
      ...this.useMockKeychain ? ['--use-mock-keychain'] : [],
      '--no-sandbox',
    ])
    cmd.stdout.pipe(process.stdout)
    cmd.stderr.pipe(process.stderr)

    let devtoolsUrlResolve
    const devtoolsUrlPromise = new Promise(_resolve => {
      devtoolsUrlResolve = _resolve
    })

    const rl = readline.createInterface({
      input: cmd.stderr,
    })

    rl.on('line', line => {
      if (line.includes('DevTools listening on')) {
        const devtoolsUrl = line.replace('DevTools listening on ', '')
        devtoolsUrlResolve(devtoolsUrl)
      }
    })

    let spawnResolve
    const spawnPromise = new Promise(_resolve => {
      spawnResolve = _resolve
    })
    cmd.on('spawn', () => {
      spawnResolve()
    })

    cmd.on('error', error => {
      this.emit('error', error)
    })

    cmd.on('exit', code => {
      console.log(`${chromeFilepath} exited with code ${code}`)
    })

    process.on('SIGTERM', () => {
      cmd.kill()
    })

    process.on('exit', () => {
      cmd.kill()
    })

    this.cmd = cmd

    await spawnPromise
    this.devtoolsUrl = await devtoolsUrlPromise

    return undefined
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> undefined
   * ```
   *
   * Terminates the Google Chrome for Testing process.
   *
   * Arguments:
   *   * (none)
   *
   * Return:
   *   * `undefined`
   *
   * ```javascript
   * googleChromeForTesting.close()
   * ```
   */
  close() {
    this.cmd.kill('SIGKILL')
  }

}

module.exports = GoogleChromeForTesting
