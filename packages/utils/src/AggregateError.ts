let AggregateErrorImpl = globalThis.AggregateError;

if (typeof AggregateErrorImpl === 'undefined') {
  class AggregateErrorClass extends Error implements AggregateError {
    constructor(public errors: any[], message = '') {
      super(message);
      this.name = 'AggregateError';
      Error.captureStackTrace(this, AggregateErrorClass);
    }
  }
  AggregateErrorImpl = function (errors: any[], message?: string) {
    return new AggregateErrorClass(errors, message);
  } as AggregateErrorConstructor;
}

export { AggregateErrorImpl as AggregateError };
