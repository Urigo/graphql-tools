import { graphql, GraphQLSchema } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { delegateToSchema } from '@graphql-tools/delegate';
import { addMocksToSchema } from '@graphql-tools/mock';
import { stitchSchemas } from '@graphql-tools/stitch';
import { assertSome } from '@graphql-tools/utils';

describe('basic stitching example', () => {
  test('works', async () => {
    let chirpSchema = makeExecutableSchema({
      typeDefs: `
        type Chirp {
          id: ID!
          text: String
          authorId: ID!
        }

        type Query {
          chirpById(id: ID!): Chirp
          chirpsByAuthorId(authorId: ID!): [Chirp]
        }
      `
    });

    chirpSchema = addMocksToSchema({ schema: chirpSchema });

    // Mocked author schema
    let authorSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          email: String
        }

        type Query {
          userById(id: ID!): User
        }
      `
    });

    authorSchema = addMocksToSchema({ schema: authorSchema });

    const linkTypeDefs = `
      extend type User {
        chirps: [Chirp]
      }

      extend type Chirp {
        author: User
      }
    `;

    const stitchedSchema = stitchSchemas({
      subschemas: [
        { schema: chirpSchema, },
        { schema: authorSchema, },
      ],
      typeDefs: linkTypeDefs,
      resolvers: {
        User: {
          chirps: {
            selectionSet: `{ id }`,
            resolve: (user, _args, context, info) => delegateToSchema({
              schema: chirpSchema,
              operation: 'query',
              fieldName: 'chirpsByAuthorId',
              args: {
                authorId: user.id,
              },
              context,
              info,
            }),
          },
        },
        Chirp: {
          author: {
            selectionSet: `{ authorId }`,
            resolve: (chirp, _args, context, info) => delegateToSchema({
              schema: authorSchema,
              operation: 'query',
              fieldName: 'userById',
              args: {
                id: chirp.authorId,
              },
              context,
              info,
            }),
          },
        },
      },
    });

    const query = `
      query {
        userById(id: 5) {
          chirps {
            id
            textAlias: text
            author {
              email
            }
          }
        }
      }
    `;

    const result = await graphql(stitchedSchema, query);

    expect(result.errors).toBeUndefined();
    assertSome(result.data)
    expect(result.data.userById.chirps[1].id).not.toBe(null);
    expect(result.data.userById.chirps[1].text).not.toBe(null);
    expect(result.data.userById.chirps[1].author.email).not.toBe(null);
  });
});

describe('stitching to interfaces', () => {
  let stitchedSchema: GraphQLSchema;
  beforeAll(() => {
    let chirpSchema = makeExecutableSchema({
      typeDefs: `
        interface Node {
          id: ID!
        }

        type Chirp implements Node {
          id: ID!
          text: String
          authorId: ID!
        }

        type Query {
          node(id: ID!): Node
          chirpsByAuthorId(authorId: ID!): [Chirp]
        }
      `
    });

    chirpSchema = addMocksToSchema({ schema: chirpSchema });

    let authorSchema = makeExecutableSchema({
      typeDefs: `
        interface Node {
          id: ID!
        }

        type User implements Node {
          id: ID!
          email: String
        }

        type Query {
          node(id: ID!): Node
        }
      `
    });

    authorSchema = addMocksToSchema({ schema: authorSchema });

    const linkTypeDefs = `
      extend type User {
        chirps: [Chirp]
      }

      extend type Chirp {
        author: User
      }
    `;

    stitchedSchema = stitchSchemas({
      subschemas: [
        { schema: chirpSchema, },
        { schema: authorSchema, },
      ],
      typeDefs: linkTypeDefs,
      resolvers: {
        User: {
          chirps: {
            selectionSet: `{ id }`,
            resolve: (user, _args, context, info) => delegateToSchema({
              schema: chirpSchema,
              operation: 'query',
              fieldName: 'chirpsByAuthorId',
              args: {
                authorId: user.id,
              },
              context,
              info,
            }),
          },
        },
        Chirp: {
          author: {
            selectionSet: `{ authorId }`,
            resolve: (chirp, _args, context, info) => delegateToSchema({
              schema: authorSchema,
              operation: 'query',
              fieldName: 'node',
              args: {
                id: chirp.authorId,
              },
              context,
              info,
            }),
          },
        },
      },
    });
  });

  test('it works with fragments', async () => {
    const queryWithFragments = `
      query {
        node(id: "fakeUserId") {
          ... on User {
            chirps {
              id
              textAlias: text
              author {
                ... on User {
                  email
                }
              }
            }
          }
        }
      }
    `;

    const resultWithFragments = await graphql(stitchedSchema, queryWithFragments);

    expect(resultWithFragments.errors).toBeUndefined();
    assertSome(resultWithFragments.data)
    expect(resultWithFragments.data.node.chirps[1].id).not.toBe(null);
    expect(resultWithFragments.data.node.chirps[1].text).not.toBe(null);
    expect(resultWithFragments.data.node.chirps[1].author.email).not.toBe(null);
  });

  test('it works without fragments', async () => {
    const queryWithoutFragments = `
      query {
        node(id: "fakeUserId") {
          ... on User {
            chirps {
              id
              author {
                email
              }
            }
          }
        }
      }
    `;

    const resultWithoutFragments = await graphql(stitchedSchema, queryWithoutFragments);

    expect(resultWithoutFragments.errors).toBeUndefined();
    assertSome(resultWithoutFragments.data)
    expect(resultWithoutFragments.data.node.chirps[1].id).not.toBe(null);
    expect(resultWithoutFragments.data.node.chirps[1].text).not.toBe(null);
    expect(resultWithoutFragments.data.node.chirps[1].author.email).not.toBe(null);

  });
});
