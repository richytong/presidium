// stream Readable => str string
const streamToString = function (stream) {
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

module.exports = streamToString
