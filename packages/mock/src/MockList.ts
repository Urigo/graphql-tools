/**
 * @internal
 */
export function isMockList(obj: any): obj is MockList {
  if (typeof obj?.len === 'number' || (Array.isArray(obj?.len) && typeof obj?.len[0] === 'number')) {
    if (typeof obj.wrappedFunction === 'undefined' || typeof obj.wrappedFunction === 'function') {
      return true;
    }
  }

  return false;
}

/**
 * This is an object you can return from your mock resolvers which calls the
 * provided `mockFunction` once for each list item.
 */
export class MockList {
  private readonly len: number | Array<number>;
  private readonly wrappedFunction: undefined | (() => unknown);

  /**
   * @param length Either the exact length of items to return or an inclusive
   * range of possible lengths.
   * @param mockFunction The function to call for each item in the list to
   * resolve it. It can return another MockList or a value.
   */
  constructor(length: number | Array<number>, mockFunction?: () => unknown) {
    this.len = length;
    if (typeof mockFunction !== 'undefined') {
      if (typeof mockFunction !== 'function') {
        throw new Error('Second argument to MockList must be a function or undefined');
      }
      this.wrappedFunction = mockFunction;
    }
  }

  /**
   * @internal
   */
  public mock() {
    let arr: Array<unknown>;
    if (Array.isArray(this.len)) {
      arr = new Array(this.randint(this.len[0], this.len[1]));
    } else {
      arr = new Array(this.len);
    }

    for (let i = 0; i < arr.length; i++) {
      if (typeof this.wrappedFunction === 'function') {
        const res = this.wrappedFunction();
        if (isMockList(res)) {
          arr[i] = res.mock();
        } else {
          arr[i] = res;
        }
      } else {
        arr[i] = undefined;
      }
    }
    return arr;
  }

  private randint(low: number, high: number): number {
    return Math.floor(Math.random() * (high - low + 1) + low);
  }
}

export function deepResolveMockList(mockList: MockList): unknown[] {
  return mockList.mock().map(v => {
    if (isMockList(v)) return deepResolveMockList(v);
    return v;
  });
}
