const Test = require('thunk-test')
const getChromeBinaryOrExecutableFilePath = require('./getChromeBinaryOrExecutableFilePath.js')

const test = new Test('getChromeBinaryOrExecutableFilePath', getChromeBinaryOrExecutableFilePath)

test.case('/path/to/Google Chrome for Testing', 'mac-x64', '/path/to/Google Chrome for Testing')
test.case('/path/to/other', 'mac-x64', undefined)
test.case('/path/to/chrome', 'linux64', '/path/to/chrome')
test.case('/path/to/other', 'linux64', undefined)
test.case('C:\\path\\to\\chrome.exe', 'win64', 'C:\\path\\to\\chrome.exe')
test.case('C:\\path\\to\\other.exe', 'win64', undefined)

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
