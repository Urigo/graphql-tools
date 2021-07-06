import { graphql, GraphQLList, Kind } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { stitchSchemas } from '@graphql-tools/stitch';
import { TransformQuery } from '@graphql-tools/wrap'

describe('works with complex transforms', () => {
  test('using TransformQuery instead of valuesFromResults', async () => {
    const bookSchema = makeExecutableSchema({
      typeDefs: `
        type Book {
          id: ID!
          title: String!
        }

        type UserBooks {
          userId: ID!
          books: [Book!]!
        }

        type Query {
          booksByUserIds(userIds: [ID!]!): [UserBooks!]!
        }
      `,
      resolvers: {
        Query: {
          booksByUserIds: (_root, { userIds }) =>
            userIds.map((userId: any) => ({
              userId,
              books: [
                {id: 'b1', title: 'Harry Potter 1'},
                {id: 'b2', title: 'Harry Potter 2'},
              ]
            }))
        }
      }
    });

    const userSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: String!
          email: String!
        }

        type Query {
          usersByIds(ids: [ID!]): [User]
        }
      `,
      resolvers: {
        Query: {
          usersByIds: (_root, args) => {
            return args.ids.map((id: string) => ({ id, email: `${id}@test.com` }));
          }
        }
      }
    });

    const linkTypeDefs = `
      extend type User {
        books: [Book!]!
      }
    `;

    const queryTransform = new TransformQuery({
      path: ['booksByUserIds'],
      queryTransformer: (selectionSet) => ({
        kind: Kind.SELECTION_SET,
        selections: [
          { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'userId' } },
          { kind: Kind.FIELD, name: { kind: Kind.NAME, value: 'books' }, selectionSet }
        ]
      }),
      resultTransformer: (results, delegationContext) => {
        const userIds = delegationContext.args['userIds'];
        const booksByUserIds = results.reduce(
          (acc: any, { userId, books }: { userId: string, books: any[] }) => {
            acc[userId] = books
            return acc
          }, {});
        const orderedAndUnwrapped = userIds.map((id: any) => booksByUserIds[id]);
        return orderedAndUnwrapped;
      }
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [bookSchema, userSchema],
      typeDefs: linkTypeDefs,
      resolvers: {
        User: {
          books: {
            selectionSet: `{ id }`,
            resolve: (user, _args, context, info) => batchDelegateToSchema({
              schema: bookSchema,
              operation: 'query',
              fieldName: 'booksByUserIds',
              key: user.id,
              argsFromKeys: (userIds) => ({ userIds }),
              context,
              info,
              transforms: [queryTransform],
              returnType: new GraphQLList(new GraphQLList(info.schema.getType('Book')!))
            }),
          },
        },
      },
    });

    const query = `
      query {
        usersByIds(ids: ["u1", "u2"]) {
          id
          books {
            id
            name: title
          }
        }
      }
    `;

    const result = await graphql(stitchedSchema, query);

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      usersByIds: [
        {
          id: 'u1',
          books: [
            {id: 'b1', name: 'Harry Potter 1'},
            {id: 'b2', name: 'Harry Potter 2'},
          ]
        },
        {
          id: 'u2',
          books: [
            {id: 'b1', name: 'Harry Potter 1'},
            {id: 'b2', name: 'Harry Potter 2'},
          ]
        }
      ]
    });
  });
});
