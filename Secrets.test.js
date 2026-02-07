const assert = require('assert')
const fs = require('fs')
const Secrets = require('./Secrets')

describe('Secrets', () => {
  it('Consumes the .secrets file and returns an object of secretName-secretValue pairs', async () => {
    await fs.promises.writeFile('.secrets', `
MY_VARIABLE_A=abc1
MY_VARIABLE_B=abc2
MY_VARIABLE_C=abc3
    `)

    const secrets = await Secrets()

    assert.equal(Object.keys(secrets).length, 3)
    assert.equal(secrets.MY_VARIABLE_A, 'abc1')
    assert.equal(secrets.MY_VARIABLE_B, 'abc2')
    assert.equal(secrets.MY_VARIABLE_C, 'abc3')
  })
})
