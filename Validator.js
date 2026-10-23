const Validator = {

  /**
   * @name Validator.Object
   *
   * @docs
   * ```specscript
   * Validator.Object(validators Object<function>) -> objectValidator function
   *
   * objectValidator(data any) -> result Object
   * ```
   */
  Object(validators) {
    return function _Object(data) {
      if (typeof data == "object") {
        const result = {}
        for (const key in validators) {
          const validator = validators[key]
          const value = data[key]
          try {
            const validated = validator(value)
            if (validated != Validator.Optional) {
              result[key] = validator(value)
            }
          } catch (error) {
            error.key = key
            throw error
          }
        }
        return result
      }
      const error = new Error("BadObject")
      error.data = data
      throw error
    }
  },

  /**
   * @name Validator.Array
   *
   * @docs
   * ```specscript
   * Validator.Array(data) -> Array
   *
   * Validator.Array(validator function) -> arrayValidator
   *
   * arrayValidator(data any) -> result Array
   * ```
   */
  Array(data) {
    if (typeof data == "function") {
      const validator = data
      return function _ArrayOf(_data) {
        if (Array.isArray(_data)) {
          const result = []
          for (let i = 0; i < _data.length; i++) {
            try {
              result.push(validator(_data[i]))
            } catch (error) {
              error.index = i
              throw error
            }
          }
          return result
        }
        const error = new Error("BadArray")
        error.data = _data
        throw error
      }
    }
    if (Array.isArray(data)) {
      return data
    }
    const error = new Error("BadArray")
    error.data = data
    throw error
  },

  /**
   * @name Validator.Number
   *
   * @docs
   * ```specscript
   * Validator.Number(data any) -> number
   * ```
   */
  Number(data) {
    if (typeof data == "number") {
      return data
    }
    const error = new Error("BadNumber")
    error.data = data
    throw error
  },

  /**
   * @name Validator.String
   *
   * @docs
   * ```specscript
   * Validator.String(data any) -> string
   * ```
   */
  String(data) {
    if (typeof data == "string") {
      return data
    }
    const error = new Error("BadString")
    error.data = data
    throw error
  },

  /**
   * @name Validator.Email
   *
   * @docs
   * ```specscript
   * Validator.Email(data any) -> email string
   * ```
   */
  Email(data) {
    if (
      data.includes("@")
      && data.includes(".")
      && !data.startsWith("@")
      && !data.endsWith("@")
      && !data.startsWith(".")
      && !data.endsWith(".")
    ) {
      return data
    }
    const error = new Error("BadEmail")
    error.data = data
    throw error
  },

  /**
   * @name Validator.Boolean
   *
   * @docs
   * ```specscript
   * Validator.Boolean(data any) -> boolean
   * ```
   */
  Boolean(data) {
    if (typeof data == "boolean") {
      return data
    }
    const error = new Error("BadBoolean")
    error.data = data
    throw error
  },

  /**
   * @name Validator.OneOf
   *
   * @docs
   * ```specscript
   * Validator.OneOf(...values Arguments) -> oneOfValidator
   *
   * oneOfValidator(data any) -> result string|number
   * ```
   */
  OneOf(...values) {
    return function _OneOf(data) {
      if (values.includes(data)) {
        return data
      }
      const error = new Error("NotOneOf")
      error.data = data
      throw error
    }
  },

  /**
   * @name Validator.Optional
   *
   * @docs
   * ```specscript
   * Validator.Optional(validator function) -> optionalValidator
   *
   * optionalValidator(data any) -> result any
   * ```
   */
  Optional(validator) {
    return function _Optional(data) {
      if (data == null) {
        return Validator.Optional
      }
      return validator(data)
    }
  },

}

module.exports = Validator
