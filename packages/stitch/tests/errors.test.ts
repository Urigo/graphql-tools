import { graphql, GraphQLError, buildSchema } from 'graphql';

import { Executor } from '@graphql-tools/delegate';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { assertSome, ExecutionResult } from '@graphql-tools/utils';

describe('passes along errors for missing fields on list', () => {
  test('if non-null', async () => {
    const typeDefs = `
      type Query {
        getOuter: Outer
      }
      type Outer {
        innerList: [Inner!]!
      }
      type Inner {
        mandatoryField: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          getOuter: () => ({
            innerList: [{ mandatoryField: 'test' }, {}],
          }),
        },
      },
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ getOuter { innerList { mandatoryField } } }';
    const originalResult = await graphql(schema, query);
    const stitchedResult = await graphql(stitchedSchema, query);
    expect(stitchedResult).toEqual(originalResult);
    assertSome(stitchedResult.errors)
    assertSome(originalResult.errors)
    expect(stitchedResult.errors[0].path).toEqual(originalResult.errors[0].path);
  });

  test('even if nullable', async () => {
    const typeDefs = `
      type Query {
        getOuter: Outer
      }
      type Outer {
        innerList: [Inner]!
      }
      type Inner {
        mandatoryField: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          getOuter: () => ({
            innerList: [{ mandatoryField: 'test' }, {}],
          }),
        },
      },
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ getOuter { innerList { mandatoryField } } }';
    const originalResult = await graphql(schema, query);
    const stitchedResult = await graphql(stitchedSchema, query);
    expect(stitchedResult).toEqual(originalResult);
    assertSome(originalResult.errors)
    assertSome(stitchedResult.errors)
    expect(stitchedResult.errors[0].path).toEqual(originalResult.errors[0].path);
  });
});

describe('passes along errors when list field errors', () => {
  test('if non-null', async () => {
    const typeDefs = `
      type Query {
        getOuter: Outer
      }
      type Outer {
        innerList: [Inner!]!
      }
      type Inner {
        mandatoryField: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          getOuter: () => ({
            innerList: [{ mandatoryField: 'test' }, new Error('test')],
          }),
        },
      },
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ getOuter { innerList { mandatoryField } } }';
    const originalResult = await graphql(schema, query);
    const stitchedResult = await graphql(stitchedSchema, query);
    expect(stitchedResult).toEqual(originalResult);
    assertSome(stitchedResult.errors)
    assertSome(originalResult.errors)
    expect(stitchedResult.errors[0].path).toEqual(originalResult.errors[0].path);
  });

  test('even if nullable', async () => {
    const typeDefs = `
      type Query {
        getOuter: Outer
      }
      type Outer {
        innerList: [Inner]!
      }
      type Inner {
        mandatoryField: String!
      }
    `;

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: {
        Query: {
          getOuter: () => ({
            innerList: [{ mandatoryField: 'test' }, new Error('test')],
          }),
        },
      },
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ getOuter { innerList { mandatoryField } } }';
    const originalResult = await graphql(schema, query);
    const stitchedResult = await graphql(stitchedSchema, query);
    expect(stitchedResult).toEqual(originalResult);
    assertSome(stitchedResult.errors)
    assertSome(originalResult.errors)
    expect(stitchedResult.errors[0].path).toEqual(originalResult.errors[0].path);
  });

  describe('passes along correct error when there are two non-null fields', () => {
    test('should work', async () => {
      const schema = makeExecutableSchema({
        typeDefs: `
          type Query {
            getBoth: Both
          }
          type Both {
            mandatoryField1: String!
            mandatoryField2: String!
          }
        `,
        resolvers: {
          Query: {
            getBoth: () => ({ mandatoryField1: 'test' }),
          },
        },
      });

      const stitchedSchema = stitchSchemas({
        subschemas: [schema],
      });

      const query = '{ getBoth { mandatoryField1 mandatoryField2 } }';
      const originalResult = await graphql(schema, query);
      const stitchedResult = await graphql(stitchedSchema, query);
      expect(stitchedResult).toEqual(originalResult);
      assertSome(stitchedResult.errors)
      assertSome(originalResult.errors)
      expect(stitchedResult.errors[0].path).toEqual(originalResult.errors[0].path);
    });
  });
});

describe('passes along errors for remote schemas', () => {
  it('it works', async () => {
    const typeDefs = `
      type Test {
        field: String!
      }

      type Query {
        test: Test!
      }
    `;

    const schema = buildSchema(typeDefs)

    const executor: Executor = () => ({
      data: {
        test: null
      },
      errors: [
        {
          message: 'INVALID_CREDENTIALS',
          path: ['test'],
        } as unknown as GraphQLError
      ],
    }) as ExecutionResult<any>;

    const stitchedSchema = stitchSchemas({
      subschemas: [{
        schema,
        executor,
      }]
    });

    const expectedResult: ExecutionResult<any> = {
      data: null,
      errors: [
        new GraphQLError(
          'INVALID_CREDENTIALS',
          undefined,
          undefined,
          undefined,
          ['test'],
        )
      ],
    };

    const query = `{
      test {
        field
      }
    }`

    const result = await graphql(stitchedSchema, query);
    expect(result).toEqual(expectedResult);
  });
});

describe('executor errors are propagated', () => {
  test('when a microservice is down', async () => {
    const containerSchemaA = makeExecutableSchema({
      typeDefs: `
          type Container {
            id: ID!
            name: String
          }

          type Query {
            containerById(id: ID!): Container
          }
      `,
      resolvers: {
        Query: {
          containerById: () => ({ id: 'ContainerID', name: 'ContainerName' }),
        },
      },
    });

    const containerSchemaB = makeExecutableSchema({
      typeDefs: `
        type Container {
          id: ID!
        }

        type Query {
          rootContainer: Container
        }
      `,
      resolvers: {
        Query: {
          rootContainer: () => ({ id: 'ContainerID' }),
        },
      },
    });

    const rejectingExecutor = async () => {
      return Promise.reject(new Error('Service is down'));
    };

    const schema = stitchSchemas({
      subschemas: [
        {
          schema: containerSchemaA,
          executor: rejectingExecutor,
          merge: {
            Container: {
              fieldName: 'containerById',
              args: ({ id }) => ({ id }),
              selectionSet: '{ id }',
            },
          },
        },
        {
          schema: containerSchemaB,
        },
      ],
    });

    const result = await graphql(
      schema,
      `
        query {
          rootContainer {
            id
            name
          }
        }
      `,
      undefined,
      {}
    );
    expect(result.data).toEqual({
      rootContainer: {
        id: 'ContainerID',
        name: null,
      },
    });

    expect(result.errors).toEqual([new GraphQLError('Service is down')]);
  });
});
