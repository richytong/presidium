// stream Readable => str string
const StreamString = function (stream) {
  return new Promise(resolve => {
    let str = ''
    stream.on('data', chunk => {
      str += chunk
    })
    stream.on('end', () => {
      resolve(str)
    })
  })
}

module.exports = StreamString
