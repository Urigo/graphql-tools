import gql from 'graphql-tag';
import { composeResolvers, ResolversComposerMapping } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { execute, GraphQLScalarType, Kind } from 'graphql';
import { IResolvers } from 'packages/graphql-tools/src';

function createAsyncIterator<T>(array: T[]): AsyncIterator<T, T, T> {
  let i = 0;
  return {
    next: async () => {
      const returnVal = {
          done: i === array.length,
          value: array[i],
      };
      i++;
      return returnVal;
    },
  };
}

describe('Resolvers composition', () => {
  it('should compose regular resolvers', async () => {
    const getFoo = () => 'FOO';
    const typeDefs = gql`
      type Query {
        foo: String
      }
    `;
    const resolvers = {
      Query: {
        foo: async () => getFoo(),
      },
    };
    const resolversComposition = {
      'Query.foo': (next: (arg0: any, arg1: any, arg2: any, arg3: any) => void) => async (root: any, args: any, context: any, info: any) => {
        const prevResult = await next(root, args, context, info);
        return getFoo() + prevResult;
      },
    };
    const composedResolvers = composeResolvers(resolvers, resolversComposition);
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: composedResolvers,
    });

    const result = await execute({
      schema,

      document: gql`
        query {
          foo
        }
      `,
    });
    expect(result.errors).toBeFalsy();
    expect(result.data!.foo).toBe('FOOFOO');
  });
  it('should compose resolvers with resolve field', async () => {
    const getFoo = () => 'FOO';
    const typeDefs = gql`
      type Query {
        foo: String
      }
    `;
    const resolvers = {
      Query: {
        foo: {
          resolve: async () => getFoo(),
        },
      },
    };
    const resolversComposition = {
      'Query.foo': (next: (arg0: any, arg1: any, arg2: any, arg3: any) => void) => async (root: any, args: any, context: any, info: any) => {
        const prevResult = await next(root, args, context, info);
        return getFoo() + prevResult;
      },
    };
    const composedResolvers = composeResolvers(resolvers, resolversComposition);
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: composedResolvers,
    });

    const result = await execute({
      schema,

      document: gql`
        query {
          foo
        }
      `,
    });
    expect(result.errors).toBeFalsy();
    expect(result.data!.foo).toBe('FOOFOO');
  });
  it('should compose subscription resolvers', async () => {
    const array1 = [1, 2];
    const array2 = [3, 4];
    const resolvers = {
      Subscription: {
        foo: {
          subscribe: () => createAsyncIterator(array1),
        },
      },
    };

    const resolversComposition = {
      'Subscription.foo': (prevAsyncIteratorFactory: any) => (root: any, args: any, context: any, info: any) => {
        const prevAsyncIterator = prevAsyncIteratorFactory(root, args, context, info);
        const newAsyncIterator = createAsyncIterator(array2);
        return {
          async next() {
            const { value: v1, done } = await prevAsyncIterator.next();
            const { value: v2 } = await newAsyncIterator.next();
            if (!done) {
              return {
                value: v1 + v2,
                done,
              };
            } else {
              return {
                value: undefined,
                done,
              };
            }
          },
          [Symbol.asyncIterator](): AsyncIterator<number> {
            return this;
          },
        };
      },
    };
    const composedResolvers = composeResolvers(resolvers, resolversComposition);
    const asyncIterator = composedResolvers.Subscription.foo.subscribe();
    expect((await asyncIterator.next()).value).toBe(4);
    expect((await asyncIterator.next()).value).toBe(6);
  });
  it('should be able to take nested composition objects', async () => {
    const getFoo = () => 'FOO';
    const typeDefs = gql`
      type Query {
        foo: String
      }
    `;
    const resolvers = {
      Query: {
        foo: async () => getFoo(),
      },
    };
    const resolversComposition: ResolversComposerMapping<typeof resolvers> = {
      Query: {
        foo: next => async () => {
          const prevResult = await next();
          return getFoo() + prevResult;
        },
      },
    };
    const composedResolvers = composeResolvers(resolvers, resolversComposition);
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: composedResolvers,
    });

    const result = await execute({
      schema,
      document: gql`
        query {
          foo
        }
      `,
    });
    expect(result.errors).toBeFalsy();
    expect(result.data!.foo).toBe('FOOFOO');
  });
  it('should be able to take nested composition objects for subscription resolvers', async () => {
    const array1 = [1, 2];
    const array2 = [3, 4];
    const resolvers = {
      Subscription: {
        foo: {
          subscribe: () => createAsyncIterator(array1),
        },
      },
    };

    const resolversComposition: ResolversComposerMapping<typeof resolvers> = {
      Subscription: {
        foo: prevAsyncIteratorFactory => (root, args, context, info) => {
          const prevAsyncIterator = prevAsyncIteratorFactory(root, args, context, info);
          const newAsyncIterator = createAsyncIterator(array2);
          return {
            async next() {
              const { value: v1, done } = await prevAsyncIterator.next();
              const { value: v2 } = await newAsyncIterator.next();
              if (!done) {
                return {
                  value: v1 + v2,
                  done,
                };
              } else {
                return {
                  value: undefined,
                  done,
                };
              }
            },
            [Symbol.asyncIterator](): AsyncIterator<number> {
              return this;
            },
          };
        },
      },
    };
    const composedResolvers = composeResolvers(resolvers, resolversComposition);
    const asyncIterator = composedResolvers.Subscription.foo.subscribe();
    expect((await asyncIterator.next()).value).toBe(4);
    expect((await asyncIterator.next()).value).toBe(6);
  });

  it('should support *.* pattern', async () => {
    const resolvers = {
      Query: {
        foo: async () => 0,
        bar: async () => 1,
      },
      Mutation: {
        qux: async () => 2,
        baz: async () => 3,
      },
    };
    const resolversComposition = {
      '*.*': [
        (next: any) => async (...args: any) => {
          const result = await next(...args);
          return result + 1;
        }
      ]
    }
    const composedResolvers = composeResolvers(resolvers, resolversComposition);

    expect(await composedResolvers.Query.foo()).toBe(1);
    expect(await composedResolvers.Query.bar()).toBe(2);
    expect(await composedResolvers.Mutation.qux()).toBe(3);
    expect(await composedResolvers.Mutation.baz()).toBe(4);
  });

  it('should support *.* pattern and run it only for field resolvers, without scalars resolvers', async () => {
    const resolvers = {
        Query: {
          me: () => ({
              id: 1,
              age: 20,
            }),
        },
        PositiveInt: new GraphQLScalarType({
          name: 'PositiveInt',
          serialize: val => parseInt(val.toString()),
          parseValue: val => parseInt(val.toString()),
          parseLiteral: literal => {
            switch (literal.kind) {
              case Kind.INT:
              case Kind.FLOAT:
              case Kind.STRING: {
                const intVal = parseInt(literal.value.toString());
                if (intVal > 0) {
                  return literal.value;
                }
              }
            }
            throw new Error(`Value ${JSON.stringify(literal)} is not a positive integer`)
          },
        })
      };

    const functionsCalledSet: Set<string> = new Set();
    const resolversComposition = {
      '*.*': [
        (next: any) => {
          functionsCalledSet.add(next.name)
          return next;
        }
      ]
    }

    composeResolvers(resolvers, resolversComposition);
    const functionsCalled = Array.from(functionsCalledSet);
    expect(functionsCalled).toContain('me');
    expect(functionsCalled).not.toContain('serialize');
    expect(functionsCalled).not.toContain('parseValue');
    expect(functionsCalled).not.toContain('parseLiteral');

  });

  it('should handle nullish properties correctly', async () => {
    const getFoo = () => 'FOO';
    const resolvers: IResolvers = {
      Query: {
        foo: async () => getFoo(),
        bar: undefined,
      },
      Mutation: undefined
    };
    const resolversComposition: ResolversComposerMapping = {
      'Query.foo': (next: (arg0: any, arg1: any, arg2: any, arg3: any) => void) => async (root: any, args: any, context: any, info: any) => {
        const prevResult = await next(root, args, context, info);
        return getFoo() + prevResult;
      },
      'Query.bar': undefined
    };
    expect(() => composeResolvers(resolvers, resolversComposition)).not.toThrow();
  })
});
