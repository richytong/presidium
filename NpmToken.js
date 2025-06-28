const pipe = require('rubico/pipe')
const get = require('rubico/get')
const fs = require('fs')

/**
 * @name NpmToken
 *
 * @synopsis
 * ```coffeescript [specscript]
 * NpmToken() -> Promise<npmToken string>
 * ```
 *
 * @description
 * Finds the npm token from `~/.npmrc`
 */

const NpmToken = async function () {
  return fs.promises.readFile(`${process.env.HOME}/.npmrc`).then(pipe([
    buffer => buffer.toString().split('\n'),
    get(0),
    value => (/\/\/registry.npmjs.org\/:_authToken=(.+)/g).exec(value),
    get(1),
  ]))
}

module.exports = NpmToken
