const https = require('https')
const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')
const extract = require('extract-zip')
const HTTP = require('./HTTP')
const XML = require('./XML')
const Readable = require('./Readable')
const walk = require('./internal/walk')
const sleep = require('./internal/sleep')

async function getChromeVersions() {
  const http = new HTTP()
  const response = await http.GET('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json')
  const data = await Readable.JSON(response)
  return data
}

function updateConsoleLog(message, platform) {
  readline.cursorTo(process.stdout, 0, undefined);
  readline.clearLine(process.stdout, 0);
  process.stdout.write(message);
}

function getPlatform() {
  let platform = os.platform()
  if (platform == 'darwin') {
    platform = 'mac'
  }
  const arch = os.arch()

  if (platform == 'mac') {
    platform = `${platform}-${arch}`
  }
  else if (platform == 'win32') {
    platform = `win${arch.slice(1)}`
  }
  else {
    platform = `${platform}${arch.slice(1)}`
  }

  return platform
}

async function getChromeUrl() {
  const platform = getPlatform()

  let url
  if (['stable', 'beta', 'dev', 'canary'].includes(this.chromeVersion)) {
    const chromeVersions = await getChromeVersions()
    const channel = `${this.chromeVersion[0].toUpperCase()}${this.chromeVersion.slice(1)}`
    const chromeVersionNumber = chromeVersions.channels[channel].version
    url = `https://storage.googleapis.com/chrome-for-testing-public/${chromeVersionNumber}/${platform}/chrome-${platform}.zip`
  } else {
    const chromeVersionNumber = this.chromeVersion
    url = `https://storage.googleapis.com/chrome-for-testing-public/${chromeVersionNumber}/${platform}/chrome-${platform}.zip`
  }

  return url
}

async function installChrome() {
  const platform = getPlatform()
  const url = await getChromeUrl.call(this)
  let filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`

  console.log('installChrome', filepath)
  if (platform.startsWith('win') && !filepath.startsWith(`${__dirname[0]}:`)) {
    filepath = path.join(process.cwd(), filepath)
  } else if (!filepath.startsWith('/')) {
    filepath = path.join(process.cwd(), filepath)
  }

  let parentDir = `${filepath.split('/').slice(0, -1).join('/')}`
  if (platform.startsWith('win') && !filepath.startsWith(`${__dirname[0]}:`)) {
    parentDir = path.join(process.cwd(), parentDir)
  } else if (!parentDir.startsWith('/')) {
    parentDir = path.join(process.cwd(), parentDir)
  }
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
      updateConsoleLog(`Downloading ${url} (${downloadedLength} / ${contentLength} bytes)\n`)
    } else {
      updateConsoleLog(`Downloading ${url} (${downloadedLength} / ${contentLength} bytes)`)
    }

    fileStream.write(chunk)
  })

  let resolve
  const promise = new Promise(_resolve => {
    resolve = _resolve
  })
  response.on('end', () => {
    resolve()
  })
  await promise

  console.log('extract', filepath)
  try {
    await extract(filepath, { dir: parentDir })
  } catch {
    await sleep(100)
    await extract(filepath, { dir: parentDir })
  }
}

async function getChromeFilepath() {
  const platform = getPlatform()
  const url = await getChromeUrl.call(this)
  const filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`
  const parentDir = `${filepath.split('/').slice(0, -1).join('/')}`

  try {
    for await (const filepath of walk(parentDir)) {
      if (platform.startsWith('mac') && filepath.endsWith('Google Chrome for Testing')) {
        return filepath
      }
      if (platform.startsWith('linux') && filepath.endsWith('chrome')) {
        return filepath
      }
      if (platform.startsWith('win') && filepath.endsWith('chrome.exe')) {
        return filepath
      }
    }
  } catch (error) {
    if (error.code == 'ENOENT') {
      await installChrome.call(this)
      const filepath = await getChromeFilepath.call(this)
      return filepath
    }
    throw error
  }

  throw new Error('unable to find Google Chrome for Testing executable.')
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
 *   * `mac-arm64`
 *   * `linux64`
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
 *
 * # disable AppArmor unprivileged security restriction
 * echo "kernel.apparmor_restrict_unprivileged_userns=0" | sudo tee /etc/sysctl.d/60-apparmor-namespace.conf
 * sudo sysctl -p /etc/sysctl.d/60-apparmor-namespace.conf
 * ```
 */
class GoogleChromeForTesting {
  constructor(options = {}) {
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
    cmd.stderr.on('data', chunk => {
      const line = chunk.toString('utf8').trim()
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
      console.error(error)
      process.exit(1)
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
