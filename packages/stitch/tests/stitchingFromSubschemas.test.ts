// The below is meant to be an alternative canonical schema stitching example
// which intermingles local (mocked) resolvers and stitched schemas and does
// not require use of the fragment field, because it follows best practices of
// always returning the necessary object fields:
// https://medium.com/paypal-engineering/graphql-resolvers-best-practices-cd36fdbcef55

// This is achieved at the considerable cost of moving all of the delegation
// logic from the gateway to each subschema so that each subschema imports all
// the required types and performs all delegation.

// The fragment field is still necessary when working with a remote schema
// where this is not possible.

import { graphql, GraphQLSchema } from 'graphql';

import { delegateToSchema } from '@graphql-tools/delegate';
import { addMocksToSchema } from '@graphql-tools/mock';
import { assertSome } from '@graphql-tools/utils';

import { stitchSchemas } from '../src/stitchSchemas';

const chirpTypeDefs = `
  type Chirp {
    id: ID!
    text: String
    authorId: ID!
    author: User
  }
`;

const authorTypeDefs = `
  type User {
    id: ID!
    email: String
    chirps: [Chirp]
  }
`;

const schemas: Record<string, GraphQLSchema> = {};
const getSchema = (name: string) => schemas[name];

let chirpSchema = stitchSchemas({
  typeDefs: [
    chirpTypeDefs,
    authorTypeDefs,
    `
      type Query {
        chirpById(id: ID!): Chirp
        chirpsByAuthorId(authorId: ID!): [Chirp]
      }
    `,
  ],
  resolvers: {
    Chirp: {
      author: (chirp, _args, context, info) =>
        delegateToSchema({
          schema: getSchema('authorSchema'),
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
});

chirpSchema = addMocksToSchema({
  schema: chirpSchema,
  mocks: {
    Chirp: () => ({
      authorId: '1',
    }),
  },
  preserveResolvers: true,
});

let authorSchema = stitchSchemas({
  typeDefs: [
    chirpTypeDefs,
    authorTypeDefs,
    `
      type Query {
        userById(id: ID!): User
      }
    `,
  ],
  resolvers: {
    User: {
      chirps: (user, _args, context, info) =>
        delegateToSchema({
          schema: getSchema('chirpSchema'),
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
});

authorSchema = addMocksToSchema({
  schema: authorSchema,
  mocks: {
    User: () => ({
      id: '1',
    }),
  },
  preserveResolvers: true,
});

schemas.chirpSchema = chirpSchema;
schemas.authorSchema = authorSchema;

const stitchedSchema = stitchSchemas({
  subschemas:Object.keys(schemas).map((schemaName) => schemas[schemaName]),
});

describe('merging without specifying fragments', () => {
  test.skip('works', async () => {
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
