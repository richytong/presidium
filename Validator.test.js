const assert = require("assert")
const Validator = require("./Validator")

const {
  Object,
  Array,
  Number,
  String,
  Email,
  Boolean,
  OneOf,
  Optional,
} = Validator

async function test0() {
  const validator = Object({
    a: Number,
    b: String,
    c: Email,
    d: Boolean,
    e: OneOf("x", "y"),
    f: Optional(Number),
    g: OneOf(Object({ x: Number }), Object({ y: Number })),
  })

  assert.deepEqual(validator({
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "x",
    g: { x: 1 },
  }), {
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "x",
    g: { x: 1 },
  })

  assert.deepEqual(validator({
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "y",
    g: { y: 1 },
  }), {
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "y",
    g: { y: 1 },
  })

  assert.deepEqual(validator({
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "x",
    f: 1,
    g: { x: 1 },
  }), {
    a: 1,
    b: "2",
    c: "test@test.test",
    d: true,
    e: "x",
    f: 1,
    g: { x: 1 },
  })

  assert.throws(
    () => validator({
      a: "1",
      b: "2",
      c: "test@test.test",
      d: true,
      e: "x",
      g: { x: 1 },
    }),
    { name: "Error", message: "BadNumber", key: "a", data: "1" },
  )

  assert.throws(
    () => validator({
      a: 1,
      b: 2,
      c: "test@test.test",
      d: true,
      e: "x",
      g: { x: 1 },
    }),
    { name: "Error", message: "BadString", key: "b", data: 2 },
  )

  assert.throws(
    () => validator({
      a: 1,
      b: "2",
      c: "@test.test",
      d: true,
      e: "x",
      g: { x: 1 },
    }),
    { name: "Error", message: "BadEmail", key: "c", data: "@test.test" },
  )

  assert.throws(
    () => validator({
      a: 1,
      b: "2",
      c: "test@test.test",
      d: NaN,
      e: "x",
      g: { x: 1 },
    }),
    { name: "Error", message: "BadBoolean", key: "d", data: NaN },
  )

  assert.throws(
    () => validator({
      a: 1,
      b: "2",
      c: "test@test.test",
      d: true,
      e: "a",
      g: { x: 1 },
    }),
    { name: "Error", message: "NotOneOf", key: "e", data: "a" },
  )

  assert.throws(
    () => validator({
      a: 1,
      b: "2",
      c: "test@test.test",
      d: true,
      e: "x",
      g: { z: 1 },
    }),
    { name: "Error", message: "NotOneOf", data: { z: 1 } },
  )
}

async function test1() {
  const validator = Object({})

  assert.throws(
    () => validator("1"),
    { name: "Error", message: "BadObject", data: "1" },
  )
}

async function test2() {
  const validator = Array

  assert.deepEqual(validator([5, 6, 7]), [5, 6, 7])

  assert.throws(
    () => validator(0),
    { name: "Error", message: "BadArray", data: 0 },
  )
}

async function test3() {
  const validator = Array(String)

  assert.deepEqual(validator(["a", "b"]), ["a", "b"])
  assert.deepEqual(validator([]), [])

  assert.throws(
    () => validator("8"),
    { name: "Error", message: "BadArray", data: "8" },
  )

  assert.throws(
    () => validator(["a", 1]),
    { name: "Error", message: "BadString", data: 1, index: 1 },
  )
}

async function test4() {
  const validator = Array(Object({ a: Number }))

  assert.deepEqual(validator([{ a: 1 }, { a: 2 }]), [{ a: 1 }, { a: 2 }])

  assert.throws(
    () => validator([{ a: 1 }, { b: 2 }]),
    { name: "Error", message: "BadObject", key: "a", data: { b: 2 } },
  )
}

async function test() {
  await test0()
  await test1()
  await test2()
  await test3()
  await test4()
  console.log("Success")
}

if (process.argv[1] == __filename) {
  test()
}

module.exports = test
