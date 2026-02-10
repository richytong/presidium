const assert = require('assert')
const fs = require('fs')
const Secrets = require('./Secrets')

describe('Secrets', () => {
  it('Consumes the .secrets file and returns an object of secretName-secretValue pairs', async () => {
    await fs.promises.writeFile('.secrets', `
MY_VARIABLE_A=production/abc1
MY_VARIABLE_B=production/abc2
MY_VARIABLE_C=abc3
    `)

    const secrets = await Secrets()

    assert.equal(Object.keys(secrets).length, 3)
    assert.equal(secrets.MY_VARIABLE_A, 'production/abc1')
    assert.equal(secrets.MY_VARIABLE_B, 'production/abc2')
    assert.equal(secrets.MY_VARIABLE_C, 'abc3')
  })

  it('Optional filepath', async () => {
    await fs.promises.writeFile(`${__dirname}/test/.secrets`, `
MY_VARIABLE_A=test/production/abc1
MY_VARIABLE_B=test/production/abc2
MY_VARIABLE_C=test/abc3
    `)

    const secrets = await Secrets(`${__dirname}/test/.secrets`)

    assert.equal(Object.keys(secrets).length, 3)
    assert.equal(secrets.MY_VARIABLE_A, 'test/production/abc1')
    assert.equal(secrets.MY_VARIABLE_B, 'test/production/abc2')
    assert.equal(secrets.MY_VARIABLE_C, 'test/abc3')
  })
})
