import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { assertSome, ExecutionResult } from '@graphql-tools/utils';
import { graphql, GraphQLError, GraphQLSchema } from 'graphql';

describe('merge failures', () => {
  const firstSchema = makeExecutableSchema({
    typeDefs: `
      type Thing {
        id: ID!
        name: String!
      }
      type Query {
        thing(id: ID!): Thing
      }
    `,
    resolvers: {
      Query: {
        thing: (_root, { id }) => ({ id, name: 'The Thing' }),
      }
    }
  });

  const getGatewaySchema = (secondSchema: GraphQLSchema): GraphQLSchema => stitchSchemas({
    subschemas: [
      {
        schema: firstSchema,
        merge: {
          Thing: {
            selectionSet: '{ id }',
            fieldName: 'thing',
            args: ({ id }) => ({ id }),
          }
        }
      },
      {
        schema: secondSchema,
        merge: {
          Thing: {
            selectionSet: '{ id }',
            fieldName: '_thing',
            args: ({ id }) => ({ id }),
          }
        }
      },
    ],
  });

  it('proxies merged errors', async () => {
    const secondSchema = makeExecutableSchema({
      typeDefs: `
        type Thing {
          id: ID!
          description: String!
        }
        type Query {
          _thing(id: ID!): Thing
        }
      `,
      resolvers: {
        Query: {
          _thing: () => new Error('unable to produce the thing'),
        }
      }
    });

    const gatewaySchema = getGatewaySchema(secondSchema);

    const result = await graphql(gatewaySchema, `
      query {
        thing(id: 23) {
          id
          name
          description
        }
      }
    `);

    const expectedResult: ExecutionResult = {
      data: { thing: null },
      errors: [new GraphQLError('unable to produce the thing')],
    }

    expect(result).toEqual(expectedResult);
  });

  test('proxies merged error arrays', async () => {
    const schema1 = makeExecutableSchema({
      typeDefs: `
        type Thing {
          id: ID!
          name: String
          desc: String
        }
        type Query {
          things(ids: [ID!]!): [Thing]!
        }
      `,
      resolvers: {
        Query: {
          things: () => [new Error('no thing')],
        },
      },
    });

    const schema2 = makeExecutableSchema({
      typeDefs: `
        type ParentThing {
          thing: Thing
        }
        type Thing {
          id: ID!
        }
        type Query {
          parent: ParentThing
        }
      `,
      resolvers: {
        Query: {
          parent: () => ({ thing: { id: 23 } }),
        },
      },
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [{
        schema: schema1,
        merge: {
          Thing: {
            selectionSet: '{ id }',
            fieldName: 'things',
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          },
        }
      }, {
        schema: schema2,
      }],
    });

    const stitchedResult = await graphql(stitchedSchema, '{ parent { thing { name desc id } } }');
    assertSome(stitchedResult.errors)
    expect(stitchedResult.errors[0].path).toEqual(['parent', 'thing', 'name']);
  });

  it('proxies inappropriate null', async () => {
    const secondSchema = makeExecutableSchema({
      typeDefs: `
        type Thing {
          id: ID!
          description: String!
        }
        type Query {
          _thing(id: ID!): Thing
        }
      `,
      resolvers: {
        Query: {
          _thing: () => null,
        }
      }
    });

    const gatewaySchema = getGatewaySchema(secondSchema);

    const result = await graphql(gatewaySchema, `
      query {
        thing(id: 23) {
          id
          name
          description
        }
      }
    `);

    const expectedResult: ExecutionResult = {
      data: { thing: null },
      errors: [new GraphQLError('Cannot return null for non-nullable field Thing.description.')],
    }

    expect(result).toEqual(expectedResult);
  });

  it('proxies errors on object', async () => {
    const secondSchema = makeExecutableSchema({
      typeDefs: `
        type Thing {
          id: ID!
          description: String!
        }
        type Query {
          _thing(id: ID!): Thing
        }
      `,
      resolvers: {
        Query: {
          _thing: () => ({}),
        }
      }
    });

    const gatewaySchema = getGatewaySchema(secondSchema);

    const result = await graphql(gatewaySchema, `
      query {
        thing(id: 23) {
          id
          name
          description
        }
      }
    `);

    const expectedResult: ExecutionResult = {
      data: { thing: null },
      errors: [new GraphQLError('Cannot return null for non-nullable field Thing.description.')],
    }

    expect(result).toEqual(expectedResult);
  });
});

describe('nullable merging', () => {
  test('works for asymmetric record sets', async () => {
    const users = [
      { id: '1', username: 'hanshotfirst' },
      { id: '2', username: 'bigvader23' },
      { id: '3', username: 'yodamecrazy' },
    ];

    const usersSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          username: String!
        }
        type Query {
          users(ids: [ID!]!): [User]!
        }
      `,
      resolvers: {
        Query: {
          users: (_root, { ids }) => ids.map((id: string) => users.find(u => u.id === id)),
        }
      }
    });

    const appUserSettings = [
      { id: '1', user_id: '1', appSetting1: 'yes', appSetting2: true },
      { id: '2', user_id: '3', appSetting1: 'no', appSetting2: false },
    ];

    const appSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          appSetting1: String
          appSetting2: Boolean
        }
        type Query {
          _users(ids: [ID!]!): [User]!
        }
      `,
      resolvers: {
        Query: {
          _users: (_root, { ids }) => ids.map((id: string) => {
            const userSettings = appUserSettings.find(u => u.user_id === id);
            return userSettings ? { ...userSettings, id } : null;
          }),
        }
      }
    });

    const gatewaySchema = stitchSchemas({
      subschemas: [
        {
          schema: usersSchema,
          merge: {
            User: {
              selectionSet: '{ id }',
              fieldName: 'users',
              key: ({ id }) => id,
              argsFromKeys: (ids) => ({ ids }),
            }
          }
        },
        {
          schema: appSchema,
          merge: {
            User: {
              selectionSet: '{ id }',
              fieldName: '_users',
              key: ({ id }) => id,
              argsFromKeys: (ids) => ({ ids }),
            }
          }
        },
      ],
    });

    const result = await graphql(gatewaySchema, `
      query {
        users(ids: [1, 2, 3]) {
          id
          username
          appSetting1
          appSetting2
        }
      }
    `);

    const expectedResult = {
      data: {
        users: [
          {
            id: '1',
            username: 'hanshotfirst',
            appSetting1: 'yes',
            appSetting2: true,
          },
          {
            id: '2',
            username: 'bigvader23',
            appSetting1: null,
            appSetting2: null,
          },
          {
            id: '3',
            username: 'yodamecrazy',
            appSetting1: 'no',
            appSetting2: false,
          },
        ],
      },
    };

    expect(result).toEqual(expectedResult);
  });
});
