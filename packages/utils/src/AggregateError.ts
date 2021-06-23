let AggregateErrorImpl = globalThis.AggregateError;

if (typeof AggregateErrorImpl === 'undefined') {
  class AggregateErrorClass extends Error implements AggregateError {
    errors: Error[];
    constructor(maybeErrors: Iterable<any>, message = '') {
      super(message);
      this.name = 'AggregateError';
      Error.captureStackTrace(this, AggregateErrorClass);
      this.errors = [...maybeErrors].map(maybeError =>
        maybeError instanceof Error ? maybeError : new Error(maybeError)
      );
    }
  }
  AggregateErrorImpl = function (errors: Iterable<any>, message?: string) {
    return new AggregateErrorClass(errors, message);
  } as AggregateErrorConstructor;
}

export { AggregateErrorImpl as AggregateError };
