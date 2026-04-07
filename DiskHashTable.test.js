const Test = require('thunk-test')
const assert = require('assert')
const DiskHashTable = require('./DiskHashTable')

const test1 = new Test('DiskHashTable', async function integration1() {
  const ht1024 = new DiskHashTable({
    storageFilepath: `${__dirname}/DiskHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.destroy()
  await ht1024.init()

  assert.strictEqual(ht1024.count(), 0)

  assert.strictEqual(await ht1024.get('notfound'), undefined)

  await ht1024.set('maroon', '#800000')
  await ht1024.set('yellow', '#FFFF00')

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  assert.equal(ht1024.count(), 2)

  await ht1024.set('maroon', '#800___')

  assert.equal(ht1024.count(), 2)

  assert.equal(await ht1024.get('maroon'), '#800___')
  await ht1024.delete('maroon').then(didDelete => assert(didDelete))

  assert.equal(ht1024.count(), 1)

  assert.strictEqual(await ht1024.get('maroon'), undefined)
  await ht1024.set('maroon', '#800000')
  assert.equal(await ht1024.get('maroon'), '#800000')

  assert.equal(ht1024.count(), 1)

  assert.strictEqual(await ht1024.get('notfound'), undefined)
  await ht1024.delete('notfound').then(didDelete => assert(!didDelete))

  assert.equal(ht1024.count(), 1)

  const ht1 = new DiskHashTable({
    storageFilepath: `${__dirname}/DiskHashTable_test_data/1`,
    headerFilepath: `${__dirname}/DiskHashTable_test_data/1_header`,
    initialLength: 1,
  })
  await ht1.destroy()
  await ht1.init()

  await ht1.set('maroon', '#800000')
  assert.strictEqual(await ht1.get('x'), undefined)

  await assert.rejects(
    ht1.set('yellow', '#FFFF00'),
    new Error('Disk hash table is full')
  )

  assert.strictEqual(await ht1024.get('notfound'), undefined)

  await assert.rejects(
    ht1024._getKey(-1),
    new Error('Negative index')
  )

  ht1024.close()
  ht1.close()
}).case()

const test1_1 = new Test('DiskHashTable', async function integration1_1() {
  const ht2 = new DiskHashTable({
    storageFilepath: `${__dirname}/DiskHashTable_test_data/2`,
    headerFilepath: `${__dirname}/DiskHashTable_test_data/2_header`,
    initialLength: 2,
  })
  await ht2.destroy()
  await ht2.init()

  await ht2.set('maroon', '#800000')
  assert.equal(await ht2.get('maroon'), '#800000')
  const collisionKey = 'maroon1'
  await ht2.set(collisionKey, '#800000(1)')
  assert.equal(await ht2.get('maroon'), '#800000')
  assert.equal(await ht2.get(collisionKey), '#800000(1)')
  await ht2.delete('maroon').then(didDelete => assert(didDelete))
  await ht2.delete('maroon').then(didDelete => assert(!didDelete))
  assert.equal(await ht2.get('maroon'), undefined)
  await ht2.delete(collisionKey).then(didDelete => assert(didDelete))
  assert.equal(await ht2.get(collisionKey), undefined)
  await ht2.delete('maroon3').then(didDelete => assert(!didDelete))

  ht2.close()
}).case()

const test1_2 = new Test('DiskHashTable', async function integration1_2() {
  const ht3 = new DiskHashTable({
    storageFilepath: `${__dirname}/DiskHashTable_test_data/3`,
    headerFilepath: `${__dirname}/DiskHashTable_test_data/3_header`,
    initialLength: 3,
  })
  await ht3.destroy()
  await ht3.init()

  await ht3.set('maroon', '#800000')
  assert.equal(await ht3.get('maroon'), '#800000')
  const collisionKey = 'maroon3'
  await ht3.set(collisionKey, '#800000(1)')
  assert.equal(await ht3.get('maroon'), '#800000')
  assert.equal(await ht3.get(collisionKey), '#800000(1)')

  ht3.close()
}).case()

const test1_3 = new Test('DiskHashTable', async function integration1_3() {
  const ht1024 = new DiskHashTable({
    storageFilepath: `${__dirname}/DiskHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.destroy()
  await ht1024.init()

  assert.strictEqual(ht1024.count(), 0)

  await ht1024.set('maroon', '#800000')
  await ht1024.set('yellow', '#FFFF00')
  await ht1024.set('black', '#000000')

  assert.equal(await ht1024.get('black'), '#000000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')
  assert.equal(await ht1024.get('black'), '#000000')

  assert.strictEqual(ht1024.count(), 3)

  await ht1024.close()
  await ht1024.init()

  assert.equal(await ht1024.get('black'), '#000000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')
  assert.equal(await ht1024.get('black'), '#000000')

  assert.strictEqual(ht1024.count(), 3)

  await ht1024.clear()

  assert.strictEqual(await ht1024.get('black'), undefined)
  assert.strictEqual(await ht1024.get('yellow'), undefined)
  assert.strictEqual(await ht1024.get('black'), undefined)

  assert.strictEqual(ht1024.count(), 0)

  ht1024.close()
}).case()

const test = Test.all([
  test1,
  test1_1,
  test1_2,
  test1_3,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
