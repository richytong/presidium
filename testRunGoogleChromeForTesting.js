const GoogleChromeForTesting = require('./GoogleChromeForTesting')

setImmediate(async () => {
  const googleChromeForTesting = new GoogleChromeForTesting({
    chromeDir: `${__dirname}/google-chrome-for-testing`,
    userDataDir: `${__dirname}/tmp/chrome`,
    headless: true,
  })
  await googleChromeForTesting.init()
})
