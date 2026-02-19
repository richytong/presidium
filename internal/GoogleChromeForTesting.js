const HTTP = require('presidium/HTTP')
const XML = require('presidium/XML')
const Readable = require('presidium/Readable')
const os = require('os')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const readline = require('readline')
const walk = require('./walk')
const extract = require('extract-zip')
const https = require('https')

async function getChromeVersions() {
  const http = new HTTP()
  const response = await http.GET('https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json')
  const data = await Readable.JSON(response)
  return data
}

function updateConsoleLog(message) {
  readline.cursorTo(process.stdout, 0, undefined);
  readline.clearLine(process.stdout, 0);
  process.stdout.write(message);
}

async function getChromeUrl() {
  let platform = os.platform()
  if (platform == 'darwin') {
    platform = 'mac'
  }
  const arch = os.arch()

  if (platform == 'mac') {
    platform = `${platform}-${arch}`
  } else {
    platform = `${platform}${arch.slice(1)}`
  }

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
  const url = await getChromeUrl.call(this)
  let filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`
  if (!filepath.startsWith('/')) {
    filepath = path.join(process.cwd(), filepath)
  }
  let parentDir = `${filepath.split('/').slice(0, -1).join('/')}`
  if (!parentDir.startsWith('/')) {
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

  await extract(filepath, { dir: parentDir })
}

async function getChromeFilepath() {
  const url = await getChromeUrl.call(this)
  const filepath = `${this.chromeDir}/${url.replace('https://storage.googleapis.com/chrome-for-testing-public/', '')}`
  const parentDir = `${filepath.split('/').slice(0, -1).join('/')}`

  const googleChromeForTestingFilepath = `${parentDir}`
  try {
    for await (const filepath of walk(parentDir)) {
      console.log(filepath)
      if (filepath.endsWith('Google Chrome for Testing')) {
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
 * }) -> GoogleChromeForTesting
 * ```
 *
 * References:
 *   * [Chrome for Testing availability](https://googlechromelabs.github.io/chrome-for-testing/)
 */
class GoogleChromeForTesting {
  constructor(options = {}) {
    this.chromeVersion = options.chromeVersion ?? 'stable'
    this.chromeDir = options.chromeDir ?? 'google-chrome-for-testing'
    this.remoteDebuggingPort = options.remoteDebuggingPort ?? 9222
    this.headless = options.headless ?? false
    this.userDataDir = options.userDataDir ?? './tmp/chrome'
    this.useMockKeychain = options.useMockKeychain ?? false
    this.devtoolsUrl = undefined
  }

  /**
   * @name init
   *
   * @docs
   * ```coffeescript [specscript]
   * init() -> Promise<>
   * ```
   */
  async init() {
    const chromeFilepath = await getChromeFilepath.call(this)
    console.log('spawn', chromeFilepath)

    const cmd = spawn(chromeFilepath, [
      `--remote-debugging-port=${this.remoteDebuggingPort}`,
      `--user-data-dir=${this.userDataDir}`,
      ...this.headless ? ['--headless'] : [],
      ...this.useMockKeychain ? ['--use-mock-keychain'] : [],
    ])
    cmd.stdout.pipe(process.stdout)
    cmd.stderr.pipe(process.stderr)

    const devtoolsUrlPromiseWithResolvers = Promise.withResolvers()
    cmd.stderr.on('data', chunk => {
      const line = chunk.toString('utf8').trim()
      if (line.includes('DevTools listening on')) {
        const devtoolsUrl = line.replace('DevTools listening on ', '')
        devtoolsUrlPromiseWithResolvers.resolve(devtoolsUrl)
      }
    })

    const spawnPromiseWithResolvers = Promise.withResolvers()
    cmd.on('spawn', () => {
      spawnPromiseWithResolvers.resolve()
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

    await spawnPromiseWithResolvers.promise
    this.devtoolsUrl = await devtoolsUrlPromiseWithResolvers.promise
  }

  /**
   * @name close
   *
   * @docs
   * ```coffeescript [specscript]
   * close() -> undefined
   * ```
   */
  close() {
    this.cmd.kill('SIGKILL')
  }

}

module.exports = GoogleChromeForTesting
