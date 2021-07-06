// The below is meant to be an alternative canonical schema stitching example
// which relies on type merging.

import { graphql } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';

import { addMocksToSchema } from '@graphql-tools/mock';

import { delegateToSchema } from '@graphql-tools/delegate';

import { RenameRootFields, RenameTypes } from '@graphql-tools/wrap';
import { assertSome } from '@graphql-tools/utils';


import { stitchSchemas } from '../src/stitchSchemas';

describe('merging using type merging', () => {
  test('works', async () => {
    let chirpSchema = makeExecutableSchema({
      typeDefs: `
        type Chirp {
          id: ID!
          text: String
          author: User
          coAuthors: [User]
          authorGroups: [[User]]
        }

        type User {
          id: ID!
          chirps: [Chirp]
        }
        type Query {
          userById(id: ID!): User
        }
      `,
    });

    chirpSchema = addMocksToSchema({ schema: chirpSchema });

    let authorSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          email: String
        }
        type Query {
          userById(id: ID!): User
        }
      `,
    });

    authorSchema = addMocksToSchema({ schema: authorSchema });

    const stitchedSchema = stitchSchemas({
      subschemas: [
        {
          schema: chirpSchema,
          merge: {
            User: {
              fieldName: 'userById',
              args: (originalResult) => ({ id: originalResult.id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
        {
          schema: authorSchema,
          merge: {
            User: {
              fieldName: 'userById',
              args: (originalResult) => ({ id: originalResult.id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
      ],
    });

    const query = `
      query {
        userById(id: 5) {
          __typename
          chirps {
            id
            textAlias: text
            author {
              email
            }
            coAuthors {
              email
            }
            authorGroups {
              email
            }
          }
        }
      }
    `;

    const result = await graphql(
      stitchedSchema,
      query,
      undefined,
      {},
    );

    expect(result.errors).toBeUndefined();
    assertSome(result.data)
    expect(result.data['userById'].__typename).toBe('User');
    expect(result.data['userById'].chirps[1].id).not.toBe(null);
    expect(result.data['userById'].chirps[1].text).not.toBe(null);
    expect(result.data['userById'].chirps[1].author.email).not.toBe(null);
  });

  test("handle top level failures on subschema queries", async() => {
    let userSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          email: String
        }
        type Query {
          userById(id: ID!): User
        }
      `,
    });

    userSchema = addMocksToSchema({ schema: userSchema });

    const failureSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          fail: Boolean
        }

        type Query {
          userById(id: ID!): User
        }
      `,
      resolvers: {
        Query: {
          userById: () => { throw new Error("failure message"); },
        }
      }
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [
        {
          schema: failureSchema,
          merge: {
            User: {
              fieldName: 'userById',
              selectionSet: '{ id }',
              args: (originalResult) => ({ id: originalResult.id }),
            }
          },
          batch: true,
        },
        {
          schema: userSchema,
          merge: {
            User: {
              fieldName: 'userById',
              selectionSet: '{ id }',
              args: (originalResult) => ({ id: originalResult.id }),
            }
          },
          batch: true,
        },
      ],
    });

    const query = `
      query {
        userById(id: 5) {  id  email fail }
      }
    `;

    const result = await graphql(
      stitchedSchema,
      query,
      undefined,
      {},
    );

    expect(result.errors).not.toBeUndefined();
    expect(result.data).toMatchObject({ userById: { fail: null }});
    expect(result.errors).toMatchObject([{
      message: "failure message",
      path: ["userById", "fail"]
    }]);
  });

  test('merging types and type extensions should work together', async () => {
    const resultSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          resultById(id: ID!): String
        }
      `,
      resolvers: {
        Query: {
          resultById: () => 'ok',
        },
      },
    });

    const containerSchemaA = makeExecutableSchema({
      typeDefs: `
          type Container {
            id: ID!
            resultId: ID!
          }

          type Query {
            containerById(id: ID!): Container
          }
      `,
      resolvers: {
        Query: {
          containerById: () => ({ id: 'Container', resultId: 'Result' }),
        },
      },
    });

    const containerSchemaB = makeExecutableSchema({
      typeDefs: `
        type Container {
          id: ID!
        }

        type Query {
          containerById(id: ID!): Container
          rootContainer: Container!
        }
      `,
      resolvers: {
        Query: {
          containerById: () => ({ id: 'Container' }),
          rootContainer: () => ({ id: 'Container' }),
        },
      },
    });

    const schema = stitchSchemas({
      subschemas: [
        {
          schema: resultSchema,
          batch: true,
        },
        {
          schema: containerSchemaA,
          merge: {
            Container: {
              fieldName: 'containerById',
              args: ({ id }) => ({ id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
        {
          schema: containerSchemaB,
          merge: {
            Container: {
              fieldName: 'containerById',
              args: ({ id }) => ({ id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
      ],
      typeDefs: `
        extend type Container {
          result: String!
        }
      `,
      resolvers: {
        Container: {
          result: {
            selectionSet: `{ resultId }`,
            resolve(container, _args, context, info) {
              return delegateToSchema({
                schema: resultSchema,
                operation: 'query',
                fieldName: 'resultById',
                args: {
                  id: container.resultId,
                },
                context,
                info,
              });
            },
          },
        },
      },
    });

    const result = await graphql(
      schema,
      `
        query TestQuery {
          rootContainer {
            id
            result
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult = {
      data: {
        rootContainer: {
          id: 'Container',
          result: 'ok',
        }
      }
    }

    expect(result).toEqual(expectedResult);
  });
});

describe('Merged associations', () => {
  const layoutSchema = makeExecutableSchema({
    typeDefs: `
      type Network {
        id: ID!
        domain: String!
      }
      type Post {
        id: ID!
        sections: [String]!
      }
      type Query {
        networks(ids: [ID!]!): [Network]!
        _posts(ids: [ID!]!): [Post]!
      }
    `,
    resolvers: {
      Query: {
        networks: (_root, { ids }) => ids.map((id: any) => ({ id, domain: `network${id}.com` })),
        _posts: (_root, { ids }) => ids.map((id: any) => ({
          id,
          sections: ['News']
        })),
      }
    }
  });

  const postsSchema = makeExecutableSchema({
    typeDefs: `
      type Network {
        id: ID!
      }
      type Post {
        id: ID!
        title: String!
        network: Network
      }
      type Query {
        posts(ids: [ID!]!): [Post]!
      }
    `,
    resolvers: {
      Query: {
        posts: (_root, { ids }) => ids.map((id: any) => ({
          id,
          title: `Post ${id}`,
          network: { id: Number(id)+2 }
        })),
      }
    }
  });

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: layoutSchema,
        merge: {
          Network: {
            selectionSet: '{ id }',
            fieldName: 'networks',
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          },
          Post: {
            selectionSet: '{ id }',
            fieldName: '_posts',
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          },
        },
      },
      {
        schema: postsSchema,
        merge: {
          Post: {
            selectionSet: '{ id }',
            fieldName: 'posts',
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          },
        },
      },
    ]
  });

  it('merges object with own remote type and association with associated remote type', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        posts(ids: [55]) {
          title
          network { domain }
          sections
        }
      }
    `);
      assertSome(data)
    expect(data['posts']).toEqual([{
      title: 'Post 55',
      network: { domain: 'network57.com' },
      sections: ['News']
    }]);
  });
});

describe('merging using type merging when renaming', () => {
  test('works', async () => {
    let chirpSchema = makeExecutableSchema({
      typeDefs: `
        type Chirp {
          id: ID!
          text: String
          author: User
          coAuthors: [User]
          authorGroups: [[User]]
        }

        type User {
          id: ID!
          chirps: [Chirp]
        }
        type Query {
          userById(id: ID!): User
        }
      `,
    });

    chirpSchema = addMocksToSchema({ schema: chirpSchema });

    let authorSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          email: String
        }
        type Query {
          userById(id: ID!): User
        }
      `,
    });

    authorSchema = addMocksToSchema({ schema: authorSchema });

    const stitchedSchema = stitchSchemas({
      subschemas: [
        {
          schema: chirpSchema,
          transforms: [new RenameTypes(name => `Gateway_${name}`), new RenameRootFields((_operation, name) => `Chirp_${name}`)],
          merge: {
            Gateway_User: {
              fieldName: 'Chirp_userById',
              args: (originalResult) => ({ id: originalResult.id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
        {
          schema: authorSchema,
          transforms: [new RenameTypes(name => `Gateway_${name}`), new RenameRootFields((_operation, name) => `User_${name}`)],
          merge: {
            Gateway_User: {
              fieldName: 'User_userById',
              args: (originalResult) => ({ id: originalResult.id }),
              selectionSet: '{ id }',
            },
          },
          batch: true,
        },
      ],
    });

    const query = `
      query {
        User_userById(id: 5) {
          __typename
          chirps {
            id
            textAlias: text
            author {
              email
            }
            coAuthors {
              email
            }
            authorGroups {
              email
            }
          }
        }
      }
    `;

    const result = await graphql(
      stitchedSchema,
      query,
      undefined,
      {},
    );

    expect(result.errors).toBeUndefined();
    assertSome(result.data)
    expect(result.data['User_userById'].__typename).toBe('Gateway_User');
    expect(result.data['User_userById'].chirps[1].id).not.toBe(null);
    expect(result.data['User_userById'].chirps[1].text).not.toBe(null);
    expect(result.data['User_userById'].chirps[1].author.email).not.toBe(null);
  });
});

describe('external object annotation with batchDelegateToSchema', () => {
  const networkSchema = makeExecutableSchema({
    typeDefs: `
      type Domain {
        id: ID!
        name: String!
      }
      type Network {
        id: ID!
        domains: [Domain!]!
      }
      type Query {
        networks(ids: [ID!]!): [Network!]!
      }
    `,
    resolvers: {
      Query: {
        networks: (_root, { ids }) =>
          ids.map((id: unknown) => ({ id, domains: [{ id: Number(id) + 3, name: `network${id}.com` }] })),
      },
    },
  })

  const postsSchema = makeExecutableSchema({
    typeDefs: `
      type Network {
        id: ID!
      }
      type Post {
        id: ID!
        network: Network!
      }
      type Query {
        posts(ids: [ID!]!): [Post]!
      }
    `,
    resolvers: {
      Query: {
        posts: (_root, { ids }) =>
          ids.map((id: unknown) => ({
            id,
            network: { id: Number(id) + 2 },
          })),
      },
    },
  })

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: networkSchema,
        merge: {
          Network: {
            fieldName: 'networks',
            selectionSet: '{ id }',
            key: (originalObject) => originalObject.id,
            argsFromKeys: (ids) => ({ ids }),
          },
        },
      },
      {
        schema: postsSchema,
      },
    ],
  })

  test('if batchDelegateToSchema can delegate 2 times the same key', async () => {
    const { data } = await graphql(
      gatewaySchema,
      `
        query {
          posts(ids: [55, 55]) {
            network {
              id
              domains {
                id
                name
              }
            }
          }
        }
      `,
    )
    assertSome(data)
    expect(data['posts']).toEqual([
      {
        network: { id: '57', domains: [{ id: '60', name: 'network57.com' }] },
      },
      {
        network: { id: '57', domains: [{ id: '60', name: 'network57.com' }] },
      },
    ])
  })
})
