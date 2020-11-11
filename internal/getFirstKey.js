// { [key string]: any } => key
const getFirstKey = object => {
  let key = null
  for (const firstKey in object) {
    key = firstKey
    break
  }
  return key
}

module.exports = getFirstKey
