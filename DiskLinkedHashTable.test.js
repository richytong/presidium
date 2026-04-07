const Test = require('thunk-test')
const assert = require('assert')
const DiskLinkedHashTable = require('./DiskLinkedHashTable')

const test1 = new Test('DiskLinkedHashTable', async function integration1() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 0)
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 0)
  }

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  assert.strictEqual(await ht1024.get('notfound'), undefined)
  await ht1024.delete('notfound').then(didDelete => assert(!didDelete))

  await ht1024.delete('maroon').then(didDelete => assert(didDelete))
  assert.strictEqual(await ht1024.get('maroon'), undefined)

  const ht1 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1_header`,
    initialLength: 1,
  })
  await ht1.init()

  assert.strictEqual(await ht1.get('x'), undefined)

  await assert.rejects(
    ht1.set('yellow', '#FFFF00', 2),
    new Error('Hash table is full')
  )

  await assert.rejects(
    ht1._getKey(-1),
    new Error('Negative index')
  )

  ht1024.close()
  ht1.close()
}).case()

const test1_1 = new Test('DiskLinkedHashTable', async function integration1_1() {
  const ht2 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/2`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/2_header`,
    initialLength: 2,
  })
  await ht2.clear()
  await ht2.init()

  await ht2.set('maroon', '#800000', 1)
  assert.equal(await ht2.get('maroon'), '#800000')
  const collisionKey = 'maroon1'
  await ht2.set(collisionKey, '#800000(1)', 1)
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

const test1_2 = new Test('DiskLinkedHashTable', async function integration1_2() {
  const ht3 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/3`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/3_header`,
    initialLength: 3,
  })
  await ht3.clear()
  await ht3.init()

  await ht3.set('maroon', '#800000', 1)
  assert.equal(await ht3.get('maroon'), '#800000')
  const collisionKey = 'maroon3'
  await ht3.set(collisionKey, '#800000(1)', 1)
  assert.equal(await ht3.get('maroon'), '#800000')
  assert.equal(await ht3.get(collisionKey), '#800000(1)')

  ht3.close()
}).case()

const test1_3 = new Test('DiskLinkedHashTable', async function integration1_3() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 'a')
  await ht1024.set('yellow', '#FFFF00', 'b')

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  await ht1024.set('black', '#000', 'd')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  await ht1024.set('maroon', '#800000', 'e')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#FFFF00')
    assert.equal(forwardValues[1], '#000')
    assert.equal(forwardValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test2 = new Test('DiskLinkedHashTable', async function integration2() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('black', '#000', 4)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('maroon', '#800000', 1)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test3 = new Test('DiskLinkedHashTable', async function integration3() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)
  await ht1024.set('maroon', '#800000', 1)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test4 = new Test('DiskLinkedHashTable', async function integration4() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)
  await ht1024.set('white', '#FFF', 3)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 4)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#FFF')
    assert.equal(forwardValues[3], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 4)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFF')
    assert.equal(reverseValues[2], '#FFFF00')
    assert.equal(reverseValues[3], '#800000')
  }

  ht1024.close()
}).case()

const test5 = new Test('DiskLinkedHashTable', async function integration5() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)
  await ht1024.set('white', '#FFF', 3)
  await ht1024.set('white2', '#FFF(2)', 3)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 5)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#FFF(2)')
    assert.equal(forwardValues[3], '#FFF')
    assert.equal(forwardValues[4], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 5)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFF')
    assert.equal(reverseValues[2], '#FFF(2)')
    assert.equal(reverseValues[3], '#FFFF00')
    assert.equal(reverseValues[4], '#800000')
  }

  await ht1024.set('white3', '#FFF(3)', 3)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 6)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#FFF(3)')
    assert.equal(forwardValues[3], '#FFF(2)')
    assert.equal(forwardValues[4], '#FFF')
    assert.equal(forwardValues[5], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 6)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFF')
    assert.equal(reverseValues[2], '#FFF(2)')
    assert.equal(reverseValues[3], '#FFF(3)')
    assert.equal(reverseValues[4], '#FFFF00')
    assert.equal(reverseValues[5], '#800000')
  }

  ht1024.close()
}).case()

const test6 = new Test('DiskLinkedHashTable', async function integration6() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  await ht1024.close()
  await ht1024.init()

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)

  assert.equal(await ht1024.get('maroon'), '#800000')
  assert.equal(await ht1024.get('yellow'), '#FFFF00')

  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  {
    const reverseValues = []
    for await (const value of ht1024.reverseIterator()) {
      reverseValues.push(value)
    }
    assert.equal(reverseValues.length, 3)
    assert.equal(reverseValues[0], '#000')
    assert.equal(reverseValues[1], '#FFFF00')
    assert.equal(reverseValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test7 = new Test('DiskLinkedHashTable', async function integration7() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.set('maroon', '#800000', 5)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#FFFF00')
    assert.equal(forwardValues[1], '#000')
    assert.equal(forwardValues[2], '#800000')
  }

  await ht1024.set('yellow', '#FFFF00', 6)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#000')
    assert.equal(forwardValues[1], '#800000')
    assert.equal(forwardValues[2], '#FFFF00')
  }

  await ht1024.set('black', '#000000', 7)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000000')
  }

  ht1024.close()
}).case()

const test8 = new Test('DiskLinkedHashTable', async function integration8() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.set('black', '#000000', 0)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#000000')
    assert.equal(forwardValues[1], '#800000')
    assert.equal(forwardValues[2], '#FFFF00')
  }

  await ht1024.set('yellow', '#FFFF00', -1)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#FFFF00')
    assert.equal(forwardValues[1], '#000000')
    assert.equal(forwardValues[2], '#800000')
  }

  await ht1024.set('maroon', '#800000', -2)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000000')
  }

  ht1024.close()
}).case()

const test9 = new Test('DiskLinkedHashTable', async function integration9() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 50)
  await ht1024.set('black', '#000', 100)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.set('yellow', '#FFFF00', 51)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.set('black', '#000000', 24)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#000000')
    assert.equal(forwardValues[2], '#FFFF00')
  }

  await ht1024.set('maroon', '#800000', 26)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#000000')
    assert.equal(forwardValues[1], '#800000')
    assert.equal(forwardValues[2], '#FFFF00')
  }

  await ht1024.set('yellow', '#FFFF00', 25)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#000000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test10 = new Test('DiskLinkedHashTable', async function integration10() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('maroon', '#800000', 3)
  await ht1024.set('yellow', '#FFFF00', 1)
  await ht1024.set('black', '#000000', 0)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#000000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#800000')
  }

  ht1024.close()
}).case()

const test11 = new Test('DiskLinkedHashTable', async function integration11() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.delete('maroon')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 2)
    assert.equal(forwardValues[0], '#FFFF00')
    assert.equal(forwardValues[1], '#000')
  }

  await ht1024.delete('yellow')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 1)
    assert.equal(forwardValues[0], '#000')
  }

  await ht1024.delete('black')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 0)
  }

  ht1024.close()
}).case()

const test12 = new Test('DiskLinkedHashTable', async function integration12() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.delete('black')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 2)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
  }

  await ht1024.delete('yellow')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 1)
    assert.equal(forwardValues[0], '#800000')
  }

  await ht1024.delete('maroon')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 0)
  }

  ht1024.close()
}).case()

const test13 = new Test('DiskLinkedHashTable', async function integration13() {
  const ht1024 = new DiskLinkedHashTable({
    storageFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024`,
    headerFilepath: `${__dirname}/DiskLinkedHashTable_test_data/1024_header`,
    initialLength: 1024,
  })
  await ht1024.clear()
  await ht1024.init()

  await ht1024.set('maroon', '#800000', 1)
  await ht1024.set('yellow', '#FFFF00', 2)
  await ht1024.set('black', '#000', 4)

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 3)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#FFFF00')
    assert.equal(forwardValues[2], '#000')
  }

  await ht1024.delete('yellow')

  {
    const forwardValues = []
    for await (const value of ht1024.forwardIterator()) {
      forwardValues.push(value)
    }
    assert.equal(forwardValues.length, 2)
    assert.equal(forwardValues[0], '#800000')
    assert.equal(forwardValues[1], '#000')
  }

  ht1024.close()
}).case()

const test = Test.all([
  test1,
  test1_1,
  test1_2,
  test1_3,
  test2,
  test3,
  test4,
  test5,
  test6,
  test7,
  test8,
  test9,
  test10,
  test11,
  test12,
  test13,
])

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
