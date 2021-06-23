import DataLoader from 'dataloader';
import { graphql, GraphQLList, GraphQLResolveInfo } from 'graphql';

import { delegateToSchema } from '@graphql-tools/delegate';
import { makeExecutableSchema } from '@graphql-tools/schema';

import { stitchSchemas } from '../src/stitchSchemas';

describe('dataloader', () => {
  test('should work', async () => {
    const taskSchema = makeExecutableSchema({
      typeDefs: `
        type Task {
          id: ID!
          text: String
          userId: ID!
        }
        type Query {
          task(id: ID!): Task
        }
      `,
      resolvers: {
        Query: {
          task: (_root, { id }) => ({
            id,
            text: `task ${id as string}`,
            userId: id,
          }),
        },
      },
    });

    const userSchema = makeExecutableSchema({
      typeDefs: `
        type User {
          id: ID!
          email: String!
        }
        type Query {
          usersByIds(ids: [ID!]!): [User]!
        }
      `,
      resolvers: {
        Query: {
          usersByIds: (_root, { ids }) =>
            ids.map((id: string) => ({ id, email: `${id}@tasks.com` })),
        },
      },
    });

    const schema = stitchSchemas({
      subschemas: [taskSchema, userSchema],
      typeDefs: `
        extend type Task {
          user: User!
        }
      `,
      resolvers: {
        Task: {
          user: {
            selectionSet: '{ userId }',
            resolve(task, _args, context, info) {
              return context.usersLoader.load({ id: task.userId, info });
            },
          },
        },
      },
    });

    const usersLoader = new DataLoader(
      async (keys: ReadonlyArray<{ id: any; info: GraphQLResolveInfo }>) => {
        const users = await delegateToSchema({
          schema: userSchema,
          operation: 'query',
          fieldName: 'usersByIds',
          args: {
            ids: keys.map((k: { id: any }) => k.id),
          },
          context: null,
          info: keys[0].info,
          returnType: new GraphQLList(keys[0].info.returnType),
        });

        expect(users).toContainEqual(
          expect.objectContaining({
            id: '1',
            email: '1@tasks.com',
          }),
        );

        return users;
      },
    );

    const query = `{
      task(id: "1") {
        id
        text
        user {
          id
          email
        }
      }
    }`;

    const result = await graphql(schema, query, null, { usersLoader });

    expect(result).toEqual({
      data: {
        task: {
          id: '1',
          text: 'task 1',
          user: {
            id: '1',
            email: '1@tasks.com',
          },
        },
      },
    });
  });
});
