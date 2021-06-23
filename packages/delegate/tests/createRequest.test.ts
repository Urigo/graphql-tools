import { graphql, Kind, GraphQLError } from 'graphql';

import { createRequest } from '../src/createRequest';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { delegateRequest } from '../src/delegateToSchema';

describe('bare requests', () => {
  test('should work', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Test {
          field: String
        }
        type Query {
          test(input: String): Test
        }
      `,
      resolvers: {
        Test: {
          field: (parent) => parent.input,
        },
        Query: {
          test: (_root, args) => ({ input: args.input }),
        }
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Test {
          field: String
        }
        type Query {
          delegate(input: String): Test
        }
      `,
      resolvers: {
        Query: {
          delegate: (_root, args, _context, info) => {
            const request = createRequest({
              fieldNodes: [{
                kind: Kind.FIELD,
                name: {
                  kind: Kind.NAME,
                  value: 'delegate',
                },
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  selections: [{
                    kind: Kind.FIELD,
                    name: {
                      kind: Kind.NAME,
                      value: 'field'
                    },
                  }],
                },
                arguments: [{
                  kind: Kind.ARGUMENT,
                  name: {
                    kind: Kind.NAME,
                    value: 'input',
                  },
                  value: {
                    kind: Kind.STRING,
                    value: args.input,
                  }
                }]
              }],
              targetOperation: 'query',
              targetFieldName: 'test',
            });
            return delegateRequest({
              request,
              schema: innerSchema,
              info
            });
          },
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query {
          delegate(input: "test") {
            field
          }
        }
      `,
    );

    expect(result).toEqual({
      data: {
        delegate: {
          field: 'test',
        },
      },
    });
  });

  test('should work with adding args on delegation', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Test {
          field: String
        }
        type Query {
          test(input: String): Test
        }
      `,
      resolvers: {
        Test: {
          field: (parent) => parent.input,
        },
        Query: {
          test: (_root, args) => ({ input: args.input }),
        }
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Test {
          field: String
        }
        type Query {
          delegate(input: String): Test
        }
      `,
      resolvers: {
        Query: {
          delegate: (_root, args, _context, info) => {
            const request = createRequest({
              fieldNodes: [{
                kind: Kind.FIELD,
                name: {
                  kind: Kind.NAME,
                  value: 'delegate',
                },
                selectionSet: {
                  kind: Kind.SELECTION_SET,
                  selections: [{
                    kind: Kind.FIELD,
                    name: {
                      kind: Kind.NAME,
                      value: 'field'
                    },
                  }],
                },
              }],
              targetOperation: 'query',
              targetFieldName: 'test',
            });
            return delegateRequest({
              request,
              schema: innerSchema,
              args,
              info,
            });
          },
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query {
          delegate(input: "test") {
            field
          }
        }
      `,
    );

    expect(result).toEqual({
      data: {
        delegate: {
          field: 'test',
        },
      },
    });
  });

  test('should work with errors', async () => {
    const innerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          test: String
        }
      `,
      resolvers: {
        Query: {
          test: () => { throw new Error('test') },
        }
      },
    });

    const outerSchema = makeExecutableSchema({
      typeDefs: `
        type Query {
          delegate: String
        }
      `,
      resolvers: {
        Query: {
          delegate: (_source, _args, _context, info) => {
            const request = createRequest({
              fieldNodes: [{
                kind: Kind.FIELD,
                name: {
                  kind: Kind.NAME,
                  value: 'delegate',
                },
              }],
              targetOperation: 'query',
              targetFieldName: 'test',
            });
            return delegateRequest({
              request,
              schema: innerSchema,
              info
            });
          },
        },
      },
    });

    const result = await graphql(
      outerSchema,
      `
        query {
          delegate
        }
      `,
    );

    expect(result).toEqual({
      data: {
        delegate: null,
      },
      errors: [new GraphQLError('test')],
    });
  });
});
