const getChromeVersions = require('./getChromeVersions')

// getChromeUrl(platform string) -> chromeUrl string
async function getChromeUrl(platform) {

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

module.exports = getChromeUrl
