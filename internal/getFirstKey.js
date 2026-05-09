// { [key string]: any } => key
const getFirstKey = object => {
  let key
  for (const firstKey in object) {
    key = firstKey
    break
  }
  return key
}

module.exports = getFirstKey
