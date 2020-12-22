// amount number => source AsyncIterable => result Array
const asyncIterableTake = amount => async function takingFromAsyncIterable(
  source,
) {
  const result = []
  let taken = 0
  for await (const item of source) {
    result.push(item)
    if (++taken == amount) {
      return result
    }
  }
  return result
}

module.exports = asyncIterableTake
