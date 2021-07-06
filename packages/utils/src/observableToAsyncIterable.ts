export interface Observer<T> {
  next: (value: T) => void;
  error: (error: Error) => void;
  complete: () => void;
}

export interface Observable<T> {
  subscribe(observer: Observer<T>): {
    unsubscribe: () => void;
  };
}

export type Callback = (value?: any) => any;

export function observableToAsyncIterable<T>(observable: Observable<T>): AsyncIterableIterator<T> {
  const pullQueue: Array<Callback> = [];
  const pushQueue: Array<any> = [];

  let listening = true;

  const pushValue = (value: any) => {
    if (pullQueue.length !== 0) {
      // It is safe to use the ! operator here as we check the length.
      pullQueue.shift()!({ value, done: false });
    } else {
      pushQueue.push({ value, done: false });
    }
  };

  const pushError = (error: any) => {
    if (pullQueue.length !== 0) {
      // It is safe to use the ! operator here as we check the length.
      pullQueue.shift()!({ value: { errors: [error] }, done: false });
    } else {
      pushQueue.push({ value: { errors: [error] }, done: false });
    }
  };

  const pushDone = () => {
    if (pullQueue.length !== 0) {
      // It is safe to use the ! operator here as we check the length.
      pullQueue.shift()!({ done: true });
    } else {
      pushQueue.push({ done: true });
    }
  };

  const pullValue = () =>
    new Promise<IteratorResult<T>>(resolve => {
      if (pushQueue.length !== 0) {
        const element = pushQueue.shift();
        // either {value: {errors: [...]}} or {value: ...}
        resolve(element);
      } else {
        pullQueue.push(resolve);
      }
    });

  const subscription = observable.subscribe({
    next(value: any) {
      pushValue(value);
    },
    error(err: Error) {
      pushError(err);
    },
    complete() {
      pushDone();
    },
  });

  const emptyQueue = () => {
    if (listening) {
      listening = false;
      subscription.unsubscribe();
      for (const resolve of pullQueue) {
        resolve({ value: undefined, done: true });
      }
      pullQueue.length = 0;
      pushQueue.length = 0;
    }
  };

  return {
    next() {
      // return is a defined method, so it is safe to call it.
      return listening ? pullValue() : this.return!();
    },
    return() {
      emptyQueue();
      return Promise.resolve({ value: undefined, done: true });
    },
    throw(error) {
      emptyQueue();
      return Promise.reject(error);
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}
