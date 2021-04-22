import { GraphQLObjectType, GraphQLSchema, graphqlSync } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { MapperKind, mapSchema } from '@graphql-tools/utils';

describe('mapSchema', () => {
  test('does not throw', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          version: String
        }
      `,
    });

    const newSchema = mapSchema(schema, {});
    expect(newSchema).toBeInstanceOf(GraphQLSchema);
  });

  test('can add a resolver', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          version: Int
        }
      `,
    });

    const newSchema = mapSchema(schema, {
      [MapperKind.QUERY]: (type) => {
        const queryConfig = type.toConfig();
        queryConfig.fields.version.resolve = () => 1;
        return new GraphQLObjectType(queryConfig);
      },
    });

    expect(newSchema).toBeInstanceOf(GraphQLSchema);

    const result = graphqlSync(newSchema, '{ version }');
    expect(result.data.version).toBe(1);
  });

  test('can change the root query name', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          version: Int
        }
      `,
    });

    const newSchema = mapSchema(schema, {
      [MapperKind.QUERY]: (type) => {
        const queryConfig = type.toConfig();
        queryConfig.name = 'RootQuery';
        return new GraphQLObjectType(queryConfig);
      },
    });

    expect(newSchema).toBeInstanceOf(GraphQLSchema);
    expect(newSchema.getQueryType().name).toBe('RootQuery');
  });

  test('apollo extensions are retained', () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type TestType {
          id: ID!
          properties: [String!]!
        }
      `,
    });

    const s = schema as any;
    s._typeMap.TestType.resolveReference = () => {};
    s._typeMap.TestType.resolveObject = () => {};

    expect(s._typeMap.TestType.resolveReference).toBeTruthy()
    expect(s._typeMap.TestType.resolveObject).toBeTruthy()

    const mappedSchema = mapSchema(schema) as any

    expect(mappedSchema._typeMap.TestType.resolveReference).toBeTruthy()
    expect(mappedSchema._typeMap.TestType.resolveObject).toBeTruthy()
  })
});
