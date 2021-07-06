import pLimit from 'p-limit';

export function useQueue<T>(options?: { concurrency?: number }) {
  const queue: Array<() => Promise<T>> = [];
  const limit = options?.concurrency ? pLimit(options.concurrency) : async (fn: () => Promise<T>) => fn();

  return {
    add(fn: () => Promise<T>) {
      queue.push(() => limit(fn));
    },
    runAll() {
      return Promise.all(queue.map(fn => fn()));
    },
  };
}

export function useSyncQueue<T>() {
  const queue: Array<() => T> = [];

  return {
    add(fn: () => T) {
      queue.push(fn);
    },
    runAll() {
      for (const fn of queue) {
        fn();
      }
    },
  };
}
