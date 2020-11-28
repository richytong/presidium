const objectSet = (object, key, value) => {
  object[key] = value
  return object
}

const objectSetEntry = (object, entry) => {
  object[entry[0]] = entry[1]
  return object
}

const objectMapKeys = function (object, mapper) {
  const result = {},
    promises = []
  for (const key in object) {
    const mappedKey = mapper(key),
      value = object[key]
    if (isPromise(mappedKey)) {
      promises.push(mappedKey.then(curry(objectSet, result, __, value)))
    } else {
      result[mappedKey] = value
    }
  }
  return promises.length == 0 ? result
    : Promise.all(promises).then(always(result))
}

const mapKeys = mapper => object => objectMapKeys(object, mapper)

module.exports = mapKeys
