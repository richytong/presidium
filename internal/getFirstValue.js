// { [key string]: value any } => value
const getFirstValue = object => {
  for (const key in object) {
    return object[key]
  }
}

module.exports = getFirstValue
