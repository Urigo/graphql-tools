import { graphql } from 'graphql';

import { delegateToSchema } from '../src/delegateToSchema';
import { makeExecutableSchema } from '@graphql-tools/schema';

describe('delegateToSchema', () => {
  test('should work', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          test(input: String): String
        }
      `,
      resolvers: {
        Query: {
          test: (_root, args) => args.input
        },
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          delegateToSchema(input: String): String
        }
      `,
      resolvers: {
        Query: {
          delegateToSchema: (_root, args, context, info) => delegateToSchema({
            schema: innerSchema,
            operation: 'query',
            fieldName: 'test',
            args,
            context,
            info,
          }),
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query {
          delegateToSchema(input: "test")
        }
      `,
    );

    expect(result.data.delegateToSchema).toEqual('test');
  });

  test('should work even where there are default fields', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          test(input: String = "test"): String
        }
      `,
      resolvers: {
        Query: {
          test: (_root, args) => args.input
        },
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          delegateToSchema(input: String = "test"): String
        }
      `,
      resolvers: {
        Query: {
          delegateToSchema: (_root, args, context, info) => delegateToSchema({
            schema: innerSchema,
            operation: 'query',
            fieldName: 'test',
            args,
            context,
            info,
          }),
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query {
          delegateToSchema
        }
      `,
    );

    expect(result.data.delegateToSchema).toEqual('test');
  });

  test('should work even when there are variables', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Parameters {
          input: String
          source: Boolean
        }
        type Query {
          test(input: String): Parameters
        }
      `,
      resolvers: {
        Query: {
          test: (source, args) => ({
            source: source !== undefined,
            ... args,
          }),
        },
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Parameters {
          input: String
          source: Boolean
        }
        type Query {
          delegateToSchema(input: String): Parameters
        }
      `,
      resolvers: {
        Query: {
          delegateToSchema: (_root, args, context, info) => delegateToSchema({
            schema: innerSchema,
            operation: 'query',
            fieldName: 'test',
            args,
            context,
            info,
          }),
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query($input: String) {
          delegateToSchema(input: $input) {
            input
            source
          }
        }
      `,
      undefined,
      undefined,
      {
        input: 'test',
      },
    );

    expect(result.data.delegateToSchema).toEqual({
      input: "test",
      source: false,
    });
  });
});
