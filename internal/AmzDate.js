/**
 * @name AmzDate
 *
 * @docs
 * ```coffeescript [specscript]
 * new AmzDate() -> string // 20211129T053254Z
 * ```
 */
const AmzDate = function () {
  const [date, time] = new Date().toISOString().replace(/\..*$/, '').split('T')
  return `${date.replace(/-/g, '')}T${time.replace(/:/g, '')}Z`
}

module.exports = AmzDate
