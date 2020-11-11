// { [key string]: any } => key
const getFirstKey = object => {
  for (const key in object) {
    return key
  }
}

module.exports = getFirstKey
