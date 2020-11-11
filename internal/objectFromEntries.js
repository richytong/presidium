// entries Array<[key string, value any]> -> Object
const objectFromEntries = function (entries) {
  const length = entries.length,
    result = {}
  let index = -1
  while (++index < length) {
    const [key, value] = entries[index]
    result[key] = value
  }
  return result
}

module.exports = objectFromEntries
