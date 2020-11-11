// { [key string]: value any } => value
const getFirstValue = object => {
  let value = null
  for (const key in object) {
    value = object[key]
    break
  }
  return value
}

module.exports = getFirstValue
