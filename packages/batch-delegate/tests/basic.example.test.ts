import { graphql } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { stitchSchemas } from '@graphql-tools/stitch';

describe('batch delegation within basic stitching example', () => {
  test('works with single keys', async () => {
    let numCalls = 0;

    const chirpSchema = makeExecutableSchema({
      typeDefs: `
        type Chirp {
          chirpedAtUserId: ID!
        }

        type Query {
          trendingChirps: [Chirp]
        }
      `,
      resolvers: {
        Query: {
          trendingChirps: () => [{ chirpedAtUserId: 1 }, { chirpedAtUserId: 2 }]
        }
      }
    });

    // Mocked author schema
    const authorSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          email: String
        }

        type Query {
          usersByIds(ids: [ID!]): [User]
        }
      `,
      resolvers: {
        Query: {
          usersByIds: (_root, args) => {
            numCalls++;
            return args.ids.map((id: string) => ({ email: `${id}@test.com`}));
          }
        }
      }
    });

    const linkTypeDefs = `
      extend type Chirp {
        chirpedAtUser: User
      }
    `;

    const stitchedSchema = stitchSchemas({
      subschemas: [chirpSchema, authorSchema],
      typeDefs: linkTypeDefs,
      resolvers: {
        Chirp: {
          chirpedAtUser: {
            selectionSet: `{ chirpedAtUserId }`,
            resolve(chirp, _args, context, info) {
              return batchDelegateToSchema({
                schema: authorSchema,
                operation: 'query',
                fieldName: 'usersByIds',
                key: chirp.chirpedAtUserId,
                argsFromKeys: (ids) => ({ ids }),
                context,
                info,
              });
            },
          },
        },
      },
    });

    const query = `
      query {
        trendingChirps {
          chirpedAtUser {
            email
          }
        }
      }
    `;

    const result = await graphql(stitchedSchema, query);

    expect(numCalls).toEqual(1);
    expect(result.errors).toBeUndefined();
    expect(result.data!['trendingChirps'][0].chirpedAtUser.email).not.toBe(null);
  });

  test('works with key arrays', async () => {
    let numCalls = 0;

    const postsSchema = makeExecutableSchema({
      typeDefs: `
        type Post {
          id: ID!
          title: String
        }

        type Query {
          posts(ids: [ID]!): [Post]!
        }
      `,
      resolvers: {
        Query: {
          posts: (_, args) => {
            numCalls += 1;
            return args.ids.map((id: unknown) => ({ id, title: `Post ${id}` }));
          }
        }
      }
    });

    const usersSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          postIds: [ID]!
        }

        type Query {
          users(ids: [ID!]!): [User]!
        }
      `,
      resolvers: {
        Query: {
          users: (_, args) => {
            return args.ids.map((id: unknown) => {
              return { id, postIds: [Number(id)+1, Number(id)+2] };
            });
          }
        }
      }
    });

    const linkTypeDefs = `
      extend type User {
        posts: [Post]!
      }
    `;

    const stitchedSchema = stitchSchemas({
      subschemas: [postsSchema, usersSchema],
      typeDefs: linkTypeDefs,
      resolvers: {
        User: {
          posts: {
            selectionSet: `{ postIds }`,
            resolve(user, _args, context, info) {
              return batchDelegateToSchema({
                schema: postsSchema,
                operation: 'query',
                fieldName: 'posts',
                key: user.postIds,
                context,
                info,
              });
            },
          },
        },
      },
    });

    const query = `
      query {
        users(ids: [1, 7]) {
          id
          posts {
            id
            title
          }
        }
      }
    `;

    const result = await graphql(stitchedSchema, query);
    expect(numCalls).toEqual(1);
    expect(result.data).toEqual({
      users: [
        {
          id: '1',
          posts: [
            { id: '2', title: 'Post 2' },
            { id: '3', title: 'Post 3' }
          ]
        },
        {
          id: '7',
          posts: [
            { id: '8', title: 'Post 8' },
            { id: '9', title: 'Post 9' }
          ]
        }
      ]
    });
  });
});
