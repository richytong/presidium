// amount number => source AsyncIterable => result Array
const asyncIterableTake = amount => async function takingFromAsyncIterable(
  source,
) {
  const result = []
  const asyncIterator = source[Symbol.asyncIterator]()
  let index = -1
  while (++index < amount) {
    const iteration = await asyncIterator.next()
    if (iteration.done) {
      return result
    }
    result.push(iteration.value)
  }
  return result
}

module.exports = asyncIterableTake
