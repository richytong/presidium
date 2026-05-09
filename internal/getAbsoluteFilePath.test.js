const Test = require('thunk-test')
const assert = require('assert')
const getAbsoluteFilePath = require('./getAbsoluteFilePath')

const test = new Test('getAbsoluteFilePath', getAbsoluteFilePath)

const cwd = process.cwd()

test.case('/test', 'linux64', '/test')
test.case('test', 'linux64', `${cwd}/test`)
test.case('/test', 'win64', `${cwd.replace(/\//g, '\\')}\\test`)
test.case('C:\\test', 'win64', 'C:\\test')
test.case('D:\\test', 'win64', 'D:\\test')

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
