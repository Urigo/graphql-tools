/* eslint-disable camelcase */
import {
  graphql,
  GraphQLResolveInfo,
  GraphQLSchema,
  buildSchema, subscribe, parse
} from 'graphql';

import { sentence, first_name } from 'casual';

import { addMocksToSchema, MockList, mockServer, IMocks, IMockStore } from '../src';
import {
  addResolversToSchema,
  makeExecutableSchema,
} from '@graphql-tools/schema';

describe('Mock retro-compatibility', () => {
  const shorthand = `
    scalar MissingMockType

    type Ability {
      name: String!
    }

    interface Flying {
      id:String!
      returnSong: String
      returnInt: Int
      returnAbility: Ability!
    }

    type Bird implements Flying {
      id:String!
      returnSong: String
      returnInt: Int
      returnString: String
      returnStringArgument(s: String): String
      returnAbility: Ability!
    }

    type Bee implements Flying {
      id:String!
      returnSong: String
      returnInt: Int
      returnEnum: SomeEnum
      returnAbility: Ability!
    }

    union BirdsAndBees = Bird | Bee

    enum SomeEnum {
      A
      B
      C
    }

    type RootQuery {
      returnInt: Int
      returnFloat: Float
      returnString: String
      returnBoolean: Boolean
      returnID: ID
      returnEnum: SomeEnum
      returnBirdsAndBees: [BirdsAndBees]
      returnFlying: [Flying]
      returnMockError: MissingMockType
      returnNullableString: String
      returnNonNullString: String!
      returnObject: Bird
      returnListOfInt: [Int]
      returnListOfIntArg(l: Int): [Int]
      returnListOfListOfInt: [[Int!]!]!
      returnListOfListOfIntArg(l: Int): [[Int]]
      returnListOfListOfObject: [[Bird!]]!
      returnStringArgument(s: String): String
      node(id:String!):Flying
      node2(id:String!):BirdsAndBees
    }

    type RootMutation{
      returnStringArgument(s: String): String
    }
    schema {
      query: RootQuery
      mutation: RootMutation
    }
  `;

  test('throws an error if you forget to pass schema', () => {
    expect(() => addMocksToSchema({} as any)).toThrowError(
      'Must provide schema to mock',
    );
  });

  test('throws an error if the property "schema" on the first argument is not of type GraphQLSchema', () => {
    expect(() =>
      addMocksToSchema({ schema: ({} as unknown) as GraphQLSchema }),
    ).toThrowError('Value at "schema" must be of type GraphQLSchema');
  });

  test('throws an error if second argument is not a Map', () => {
    const jsSchema = buildSchema(shorthand);
    expect(() =>
      addMocksToSchema({
        schema: jsSchema,
        mocks: (['a'] as unknown) as IMocks,
      }),
    ).toThrowError('mocks must be of type Object');
  });

  test('mocks the default types for you', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {};
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnInt
      returnFloat
      returnBoolean
      returnString
      returnID
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnInt).toBeGreaterThanOrEqual(-1000);
      expect(res.data.returnInt).toBeLessThanOrEqual(1000);
      expect(res.data.returnFloat).toBeGreaterThanOrEqual(-1000);
      expect(res.data.returnFloat).toBeLessThanOrEqual(1000);
      expect(typeof res.data.returnBoolean).toBe('boolean');
      expect(typeof res.data.returnString).toBe('string');
      expect(typeof res.data.returnID).toBe('string');
    });
  });

  test('lets you use mockServer for convenience', () => {
    const testQuery = `{
      returnInt
      returnFloat
      returnBoolean
      returnString
      returnID
      returnBirdsAndBees {
        ... on Bird {
          returnInt
          returnString
        }
        ... on Bee {
          returnInt
          returnEnum
        }
      }
    }`;
    const mockMap = {
      Int: () => 12345,
      Bird: () => ({ returnInt: () => 54321 }),
      Bee: () => ({ returnInt: () => 54321 }),
    };
    return mockServer(shorthand, mockMap)
      .query(testQuery)
      .then((res: any) => {
        expect(res.data.returnInt).toBe(12345);
        expect(res.data.returnFloat).toBeGreaterThanOrEqual(-1000);
        expect(res.data.returnFloat).toBeLessThanOrEqual(1000);
        expect(typeof res.data.returnBoolean).toBe('boolean');
        expect(typeof res.data.returnString).toBe('string');
        expect(typeof res.data.returnID).toBe('string');
        // tests that resolveType is correctly set for unions and interfaces
        // and that the correct mock function is used
        expect(res.data.returnBirdsAndBees[0].returnInt).toBe(54321);
        expect(res.data.returnBirdsAndBees[1].returnInt).toBe(54321);
      });
  });

  test('mockServer is able to preserveResolvers of a prebuilt schema', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootQuery: {
        returnString: () => 'someString',
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    const testQuery = `{
      returnInt
      returnString
      returnBirdsAndBees {
        ... on Bird {
          returnInt
        }
        ... on Bee {
          returnInt
        }
      }
    }`;
    const mockMap = {
      Int: () => 12345,
      Bird: () => ({ returnInt: () => 54321 }),
      Bee: () => ({ returnInt: () => 54321 }),
    };
    return mockServer(jsSchema, mockMap, true)
      .query(testQuery)
      .then((res: any) => {
        expect(res.data.returnInt).toBe(12345);
        expect(res.data.returnString).toBe('someString');
        // tests that resolveType is correctly set for unions and interfaces
        // and that the correct mock function is used
        expect(res.data.returnBirdsAndBees[0].returnInt).toBe(54321);
        expect(res.data.returnBirdsAndBees[1].returnInt).toBe(54321);
      });
  });

  test('lets you use mockServer with prebuilt schema', () => {
    const jsSchema = buildSchema(shorthand);
    const testQuery = `{
      returnInt
      returnFloat
      returnBoolean
      returnString
      returnID
      returnBirdsAndBees {
        ... on Bird {
          returnInt
          returnString
        }
        ... on Bee {
          returnInt
          returnEnum
        }
      }
    }`;
    const mockMap = {
      Int: () => 12345,
      Bird: () => ({ returnInt: () => 54321 }),
      Bee: () => ({ returnInt: () => 54321 }),
    };
    return mockServer(jsSchema, mockMap)
      .query(testQuery)
      .then((res: any) => {
        expect(res.data.returnInt).toBe(12345);
        expect(res.data.returnFloat).toBeGreaterThanOrEqual(-1000);
        expect(res.data.returnFloat).toBeLessThanOrEqual(1000);
        expect(typeof res.data.returnBoolean).toBe('boolean');
        expect(typeof res.data.returnString).toBe('string');
        expect(typeof res.data.returnID).toBe('string');
        // tests that resolveType is correctly set for unions and interfaces
        // and that the correct mock function is used
        expect(res.data.returnBirdsAndBees[0].returnInt).toBe(54321);
        expect(res.data.returnBirdsAndBees[1].returnInt).toBe(54321);
      });
  });

  test('does not mask resolveType functions if you tell it not to', () => {
    let jsSchema = buildSchema(shorthand);
    let spy = 0;
    const resolvers = {
      BirdsAndBees: {
        __resolveType(data: any, _context: any, info: GraphQLResolveInfo) {
          ++spy;
          return info.schema.getType(data.__typename);
        },
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: {},
      preserveResolvers: true,
    });
    const testQuery = `{
      returnBirdsAndBees {
        ... on Bird {
          returnInt
          returnString
        }
        ... on Bee {
          returnInt
          returnEnum
        }
      }
    }`;
    return graphql(jsSchema, testQuery).then((_res) => {
      // the resolveType has been called twice
      expect(spy).toBe(2);
    });
  });

  // TODO test mockServer with precompiled schema
  test('can mock Enum', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {};
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnEnum
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(['A', 'B', 'C']).toContain(res.data.returnEnum);
    });
  });

  test('can mock Enum with a certain value', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      SomeEnum: () => 'C',
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnEnum
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect('C').toBe(res.data.returnEnum);
    });
  });

  test('can mock Unions', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      Int: () => 10,
      String: () => 'aha',
      SomeEnum: () => 'A',
      RootQuery: () => ({
        returnBirdsAndBees: () => new MockList(40),
      }),
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnBirdsAndBees {
        ... on Bird {
          returnInt
          returnString
        }
        ... on Bee {
          returnInt
          returnEnum
        }
      }
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      // XXX this test is expected to fail once every 2^40 times ;-)
      expect(res.data.returnBirdsAndBees).toContainEqual(
        expect.objectContaining({
          returnInt: 10,
          returnString: 'aha',
        }),
      );
      return expect(res.data.returnBirdsAndBees).toContainEqual(
        expect.objectContaining({
          returnInt: 10,
          returnEnum: 'A',
        }),
      );
    });
  });

  test('can mock Interfaces by default', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      Int: () => 10,
      String: () => 'aha',
      SomeEnum: () => 'A',
      RootQuery: () => ({
        returnFlying: () => new MockList(40),
      }),
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
    });
    const testQuery = `{
      returnFlying {
        ... on Bird {
          returnInt
          returnString
        }
        ... on Bee {
          returnInt
          returnEnum
        }
      }
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnFlying).toContainEqual(
        expect.objectContaining({
          returnInt: 10,
          returnString: 'aha',
        }),
      );
      return expect(res.data.returnFlying).toContainEqual(
        expect.objectContaining({
          returnInt: 10,
          returnEnum: 'A',
        }),
      );
    });
  });

  it('can mock nullable Interfaces', () => {
    let jsSchema = buildSchema(shorthand);

    const mockMap = {
      Bird: (): null => null,
      Bee: (): null => null,
      Flying: (_: any, args: any) => {
        const { id } = args;
        const type = id.split(':')[0];
        // tslint:disable-next-line
        const __typename = ['Bird', 'Bee'].find(
          (r) => r.toLowerCase() === type,
        );
        return { __typename };
      },
    };

    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });

    const testQuery = `{
      node(id: "someid") {
        id
      }
    }`;

    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.node).toEqual(null);
    });
  });

  test('can support explicit Interface mock with __typename', async () => {
    const mockMap = {
      Bird: () => ({
        id: 'bird:hardcoded',
      }),
      Bee: () => ({
        id: 'bee:hardcoded',
      }),
      Flying: () => ({
        __typename: 'Bee',
      }),
    };
    const server = mockServer(shorthand,  mockMap);
    const testQuery = `{
      node(id:"bee:123456"){
        id
        returnAbility {
          name
        }
      }
    }`;

    const res = await server.query(testQuery);

    expect(res.data.node).toEqual({
      id: 'bee:hardcoded',
      returnAbility: {
        name: 'Hello World',
      },
    });
  });

  test('can support explicit Interface mock with resolver', () => {
    let jsSchema = buildSchema(shorthand);
    let spy = 0;
    const mockMap = {
      Bird: () => ({
        returnInt: 100,
      }),
      Bee: () => ({
        returnInt: 200,
      }),
      Flying: () => ({
        returnSong: 'I believe i can fly'
      })
    };
    const resolvers = (store: IMockStore) => ({
      RootQuery: {
        node: (_root: any, args: any) => {
          spy++;
          const { id } = args;
          const type = id.split(':')[0];
          const __typename = ['Bird', 'Bee'].find(
            (r) => r.toLowerCase() === type,
          );
          return store.get(__typename, id);
        }
      }
    });
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      resolvers,
    });
    const testQuery = `{
      node(id:"bee:123456"){
        id,
        returnSong,
        returnInt,
      }
    }`;

    return graphql(jsSchema, testQuery).then((res) => {
      expect(spy).toBe(1); // to make sure that Flying possible types are not randomly selected
      expect(res.data.node).toMatchObject({
        id: 'bee:123456',
        returnSong: 'I believe i can fly',
        returnInt: 200,
      });
    });
  });

  test('can support explicit UnionType mock', () => {
    let jsSchema = buildSchema(shorthand);
    let spy = 0;
    const mockMap = {
      Bird: () => ({
        id: 'bird:hardcoded',
        returnInt: 100,
      }),
      Bee: () => ({
        id: 'bee:hardcoded',
        returnEnum: 'A',
      }),
      BirdsAndBees: () => {
        spy++;
        return {
          __typename: 'Bee',
        };
      },
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
    });
    const testQuery = `{
        node2(id:"bee:123456"){
          ...on Bee{
            id,
            returnEnum
          }
        }
      }`;

    return graphql(jsSchema, testQuery).then((res) => {
      expect(spy).toBe(1);
      expect(res.data.node2).toMatchObject({
        id: 'bee:hardcoded',
        returnEnum: 'A',
      });
    });
  });

  test('throws an error when __typename is not returned within an explicit interface mock', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      Bird: (_root: any, args: any) => ({
        id: args.id,
        returnInt: 100,
      }),
      Bee: (_root: any, args: any) => ({
        id: args.id,
        returnInt: 100,
      }),
      Flying: (_root: any, _args: any) => ({}),
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
          node(id:"bee:123456"){
            id,
            returnInt
          }
        }`;
    const expected = 'Please return a __typename in "Flying"';
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.errors[0].originalError.message).toBe(expected);
    });
  });

  test('throws an error in resolve if mock type is not defined', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {};
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnMockError
    }`;
    const expected = 'No mock defined for type "MissingMockType"';
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.errors[0].originalError.message).toBe(expected);
    });
  });

  test('throws an error in resolve if mock type is not defined and resolver failed', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      MissingMockType: {
        __serialize: (val: string) => val,
        __parseValue: (val: string) => val,
        __parseLiteral: (val: string) => val,
      },
      RootQuery: {
        returnMockError: (): string => undefined,
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);

    const mockMap = {};
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
        returnMockError
      }`;
    const expected = 'No mock defined for type "MissingMockType"';
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.errors[0].originalError.message).toBe(expected);
    });
  });

  test('can preserve scalar resolvers', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      MissingMockType: {
        __serialize: (val: string) => val,
        __parseValue: (val: string) => val,
        __parseLiteral: (val: string) => val,
      },
      RootQuery: {
        returnMockError: () => '10-11-2012',
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);

    const mockMap = {};
    addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
      returnMockError
    }`;
    const expected = {
      returnMockError: '10-11-2012',
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
      expect(res.errors).toBeUndefined();
    });
  });

  test('can mock an Int', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { Int: () => 55 };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnInt
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnInt).toBe(55);
    });
  });

  test('can mock a Float', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { Float: () => 55.5 };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnFloat
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnFloat).toBe(55.5);
    });
  });
  test('can mock a String', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { String: () => 'a string' };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnString
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnString).toBe('a string');
    });
  });
  test('can mock a Boolean', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { Boolean: () => true };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnBoolean
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnBoolean).toBe(true);
    });
  });
  test('can mock an ID', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { ID: () => 'ea5bdc19' };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnID
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnID).toBe('ea5bdc19');
    });
  });
  test('nullable type is nullable', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { String: (): null => null };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnNullableString
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnNullableString).toBe(null);
    });
  });
  test('can mock a nonNull type', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { String: () => 'nonnull' };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnNonNullString
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnNonNullString).toBe('nonnull');
    });
  });
  test('nonNull type is not nullable', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { String: (): null => null };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnNonNullString
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toBe(null);
      expect(res.errors.length).toBe(1);
    });
  });
  test('can mock object types', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      String: () => 'abc',
      Int: () => 123,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnObject { returnInt, returnString }
    }`;
    const expected = {
      returnObject: { returnInt: 123, returnString: 'abc' },
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('can mock a list of ints', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = { Int: () => 123 };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfInt
    }`;
    const expected = {
      returnListOfInt: [123, 123],
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('can mock a list of lists of objects', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      String: () => 'a',
      Int: () => 1,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfListOfObject { returnInt, returnString }
    }`;
    const expected = {
      returnListOfListOfObject: [
        [
          { returnInt: 1, returnString: 'a' },
          { returnInt: 1, returnString: 'a' },
        ],
        [
          { returnInt: 1, returnString: 'a' },
          { returnInt: 1, returnString: 'a' },
        ],
      ],
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('does not mask resolvers if you tell it not to', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      RootQuery: () => ({
        returnInt: (_root: any, _args: Record<string, any>) => 42, // a) in resolvers, will not be used
        returnFloat: (_root: any, _args: Record<string, any>) => 1.3, // b) not in resolvers, will be used
        returnString: (_root: any, _args: Record<string, any>) =>
          Promise.resolve('foo'), // c) in resolvers, will not be used
      }),
    };
    const resolvers = {
      RootQuery: {
        returnInt: () => 5, // see a)
        returnString: () => Promise.resolve('bar'), // see c)
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
      returnInt
      returnFloat
      returnString
    }`;
    const expected = {
      returnInt: 5, // a) from resolvers, not masked by mock
      returnFloat: 1.3, // b) from mock
      returnString: 'bar', // c) from resolvers, not masked by mock (and promise)
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock non-leaf types conveniently', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      Bird: () => ({
        returnInt: 12,
        returnString: 'woot!?',
      }),
      Int: () => 15,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnObject{
        returnInt
        returnString
      }
      returnInt
    }`;
    const expected = {
      returnObject: {
        returnInt: 12,
        returnString: 'woot!?',
      },
      returnInt: 15,
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock and resolve non-leaf types concurrently', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootQuery: {
        returnListOfInt: () => [1, 2, 3],
        returnObject: () => ({
          returnInt: 12, // a) part of a Bird, should not be masked by mock
          // no returnString returned
        }),
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    const mockMap = {
      returnListOfInt: () => [5, 6, 7],
      Bird: () => ({
        returnInt: 3, // see a)
        returnString: 'woot!?', // b) another part of a Bird
      }),
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
      returnListOfInt
      returnObject{
        returnInt
        returnString
      }
    }`;
    const expected = {
      returnListOfInt: [1, 2, 3],
      returnObject: {
        returnInt: 12, // from the resolver, see a)
        returnString: 'woot!?', // from the mock, see b)
      },
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock and resolve non-leaf types concurrently, support promises', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootQuery: {
        returnObject: () =>
          Promise.resolve({
            returnInt: 12, // a) part of a Bird, should not be masked by mock
            // no returnString returned
          }),
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    const mockMap = {
      Bird: () => ({
        returnInt: 3, // see a)
        returnString: 'woot!?', // b) another part of a Bird
      }),
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
        returnObject{
          returnInt
          returnString
        }
      }`;
    const expected = {
      returnObject: {
        returnInt: 12, // from the resolver, see a)
        returnString: 'woot!?', // from the mock, see b)
      },
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock and resolve non-leaf types concurrently, support defineProperty', () => {
    let jsSchema = buildSchema(shorthand);
    const objProxy = {};
    Object.defineProperty(
      objProxy,
      'returnInt', // a) part of a Bird, should not be masked by mock
      { value: 12 },
    );
    const resolvers = {
      RootQuery: {
        returnObject: () => objProxy,
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    const mockMap = {
      Bird: () => ({
        returnInt: 3, // see a)
        returnString: 'woot!?', // b) another part of a Bird
      }),
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
        returnObject{
          returnInt
          returnString
        }
      }`;
    const expected = {
      returnObject: {
        returnInt: 12, // from the resolver, see a)
        returnString: 'woot!?', // from the mock, see b)
      },
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('let you mock with preserving resolvers', () => {
    const resolvers = {
      RootQuery: {
        returnString: () => 'woot!?', // a) resolve of a string
      },
    };
    let jsSchema = makeExecutableSchema({
      typeDefs: [shorthand],
      resolvers,
    });
    const mockMap = {
      Int: () => 123, // b) mock of Int.
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
      returnObject {
        returnInt
          returnString
      }
      returnString
    }`;
    const expected = {
      returnObject: {
        returnInt: 123, // from the mock, see b)
        returnString: 'Hello World', // from mock default values.
      },
      returnString: 'woot!?', // from the mock, see a)
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('let you resolve null with mocking and preserving resolvers', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootQuery: {
        returnString: (): string => null, // a) resolve of a string
      },
    };
    jsSchema = addResolversToSchema(jsSchema, resolvers);
    const mockMap = {
      Int: () => 666, // b) mock of Int.
    };
    jsSchema = addMocksToSchema({
      schema: jsSchema,
      mocks: mockMap,
      preserveResolvers: true,
    });
    const testQuery = `{
      returnObject {
        returnInt
        returnString
      }
      returnString
    }`;
    const expected = {
      returnObject: {
        returnInt: 666, // from the mock, see b)
        returnString: 'Hello World', // from mock default values.
      },
      returnString: null as string, // from the mock, see a)
    };
    return graphql(jsSchema, testQuery, undefined, {}).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock root query fields', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootQuery: {
        returnStringArgument: (_: void, a: Record<string, any>) => a.s,
      },
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, resolvers });
    const testQuery = `{
      returnStringArgument(s: "adieu")
    }`;
    const expected = {
      returnStringArgument: 'adieu',
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock root mutation fields', () => {
    let jsSchema = buildSchema(shorthand);
    const resolvers = {
      RootMutation: {
        returnStringArgument: (_: void, a: Record<string, any>) => a.s,
      },
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, resolvers });
    const testQuery = `mutation {
      returnStringArgument(s: "adieu")
    }`;
    const expected = {
      returnStringArgument: 'adieu',
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock a list of a certain length', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      RootQuery: () => ({ returnListOfInt: () => new MockList(3) }),
      Int: () => 12,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfInt
    }`;
    const expected = {
      returnListOfInt: [12, 12, 12],
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('lets you mock a list of a random length', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      RootQuery: () => ({ returnListOfInt: () => new MockList([10, 20]) }),
      Int: () => 12,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfInt
    }`;
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data.returnListOfInt.length).toBeGreaterThanOrEqual(10);
      expect(res.data.returnListOfInt.length).toBeLessThanOrEqual(20);
      expect(res.data.returnListOfInt[0]).toBe(12);
    });
  });

  test('lets you provide a function for your MockList', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      RootQuery: () => ({
        returnListOfInt: () => new MockList(2, () => 33),
      }),
      Int: () => 12,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfInt
    }`;
    const expected = {
      returnListOfInt: [33, 33],
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('throws an error if the second argument to MockList is not a function', () => {
    expect(
      () =>
        new MockList(5, ('abc' as any)),
    ).toThrowError(
      'Second argument to MockList must be a function or undefined',
    );
  });

  test('lets you nest MockList in MockList', () => {
    let jsSchema = buildSchema(shorthand);
    const mockMap = {
      RootQuery: () => ({
        returnListOfListOfInt: () => new MockList(2, () => new MockList(3)),
      }),
      Int: () => 12,
    };
    jsSchema = addMocksToSchema({ schema: jsSchema, mocks: mockMap });
    const testQuery = `{
      returnListOfListOfInt
    }`;
    const expected = {
      returnListOfListOfInt: [
        [12, 12, 12],
        [12, 12, 12],
      ],
    };
    return graphql(jsSchema, testQuery).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  test('works for resolvers returning javascript Dates', () => {
    const typeDefs = `
      scalar Date

      type DateObject {
        start: Date!
      }

      type Query {
        date1: DateObject
        date2: Date
        date3: Date
      }
    `;

    const resolvers = {
      Query: {
        date1: () => ({
          start: new Date('2018-01-03'),
        }),
        date2: () => new Date('2016-01-01'),
      },
      DateObject: {
        start: (obj: { start: Date }) => obj.start,
      },
      Date: {
        __serialize: (val: Date) => val.toISOString(),
        __parseValue: (val: string) => new Date(val),
        __parseLiteral: (val: string) => new Date(val),
      },
    };

    let schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    schema = addMocksToSchema({
      schema,
      mocks: {
        Date: () => new Date('2016-05-04'),
      },
      preserveResolvers: true,
    });

    const query = `
    {
      date1 {
        start
      }
      date2
      date3
    }
    `;

    const expected = {
      date1: {
        start: '2018-01-03T00:00:00.000Z',
      },
      date2: '2016-01-01T00:00:00.000Z',
      date3: '2016-05-04T00:00:00.000Z',
    };
    return graphql(schema, query).then((res) => {
      expect(res.data).toEqual(expected);
    });
  });

  it('should preserve resolvers for custom scalars if preserveResolvers: true', async () => {
    // Construct a schema, using GraphQL schema language
    const typeDefs = /* GraphQL */ `
      scalar DateTime

      type SomeObject {
        floatResolved: Float
        floatMocked: Float
        dateResolved: DateTime
        dateMocked: DateTime
      }

      type Query {
        someObject: SomeObject
      }
    `;

    // Provide resolver functions for your schema fields
    const resolvers = {
      Query: {
        someObject() {
          return {
            floatResolved: 42.2,
            dateResolved: '2018-11-11T11:11:11.270Z',
          };
        },
      },
    };

    let schema = makeExecutableSchema({
      typeDefs,
      resolvers,
    });

    const mocks = {
      Float: () => 777,
      DateTime: () => '2000-01-01T00:00:00.270Z',
    };

    schema = addMocksToSchema({
      schema,
      mocks,
      preserveResolvers: true,
    });
    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        query {
          someObject {
            floatResolved
            floatMocked
            dateResolved
            dateMocked
          }
        }
      `,
    });

    expect(result).toEqual({
      data: {
        someObject: {
          floatResolved: 42.2,
          floatMocked: 777,
          dateResolved: '2018-11-11T11:11:11.270Z',
          dateMocked: '2000-01-01T00:00:00.270Z',
        },
      },
    });
  });

  it('should work with casual and MockList', async () => {
    const mocks = {
      Date: () => new Date(),
      Review: () => ({
        sentence,
      }),
      User: () => ({
        first_name,
      }),
      Query: () => ({
        reviews: () => new MockList([1, 4]),
      }),
    };

    let schema = buildSchema(/* GraphQL */ `
      scalar Date
      type Review {
        sentence: String
        user: User
      }
      type User {
        first_name: String
      }
      type Query {
        reviews: [Review]
      }
    `);

    schema = addMocksToSchema({ schema, mocks });

    const result = await graphql({
      schema,
      source: /* GraphQL */ `
        {
          reviews {
            sentence
            user {
              first_name
            }
          }
        }
      `,
    });

    expect(result.data?.reviews?.length <= 4).toBeTruthy();
    expect(typeof result.data?.reviews[0]?.sentence).toBe('string');
    expect(typeof result.data?.reviews[0]?.user?.first_name).toBe('string');
  });

  it('resolves subscriptions only once', async () => {
    let schema = buildSchema(/* GraphQL */ `
      type Foo {
        bar: String
      }
      type Query {
        foo: Foo
      }
      type Subscription {
        fooSub: Foo
      }
    `);

    schema = addMocksToSchema({ schema });

    const resultIterator = await subscribe({
      schema,
      document: /* GraphQL */ parse(`
        subscription FooSub {
          fooSub {
            bar
          }
        }
      `),
    });

    expect(resultIterator[Symbol.asyncIterator]).toBeTruthy();

    for await (const result of resultIterator as any) {
      expect(result).toBe({
        fooSub: {
          bar: 'Hello World!'
        }
      })
    }

  })

  // TODO add a test that checks that even when merging defaults, lists invoke
  // the function for every object, not just once per list.

  // TODO test that you can call mock server with a graphql-js schema
});
