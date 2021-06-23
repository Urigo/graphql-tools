import { wrapSchema, TransformEnumValues } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, GraphQLEnumType } from 'graphql';

function assertGraphQLEnumType(input: unknown): asserts input is GraphQLEnumType {
  if (input instanceof GraphQLEnumType) {
    return
  }
  throw new Error("Expected GraphQLEnumType.")
}

describe('TransformEnumValues', () => {
  test('works', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        enum TestEnum {
          ONE
        }

        type Query {
          test(argument: TestEnum): TestEnum
        }
      `,
      resolvers: {
        Query: {
          test: (_root, { argument }) => argument,
        }
      }
    });

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new TransformEnumValues(
          (_typeName, _externalValue, valueConfig) => ['UNO', valueConfig],
        )
      ],
    });

    const query = `{
      test(argument: UNO)
    }`;

    const result = await graphql(transformedSchema, query);
    expect(result.errors).toBeUndefined();
  });

  test('allows modification of external and internal values', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        enum TestEnum {
          ONE
        }

        type Query {
          test(argument: TestEnum): TestEnum
        }
      `,
      resolvers: {
        Query: {
          test: (_root, { argument }) => argument,
        }
      }
    });

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new TransformEnumValues(
          (_typeName, _externalValue, valueConfig) => ['UNO', {
            ...valueConfig,
            value: 'ONE',
          }],
        )
      ],
    });

    const query = `{
      test(argument: UNO)
    }`;

    const result = await graphql(transformedSchema, query);
    expect(result.errors).toBeUndefined();
    const TestEnum = transformedSchema.getType('TestEnum')
    assertGraphQLEnumType(TestEnum)
    expect(TestEnum.getValue('UNO')?.value).toBe('ONE');
  });

  test('works with variables', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        enum TestEnum {
          ONE
        }

        type Query {
          test(argument: TestEnum): TestEnum
        }
      `,
      resolvers: {
        Query: {
          test: (_root, { argument }) => argument,
        }
      }
    });

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new TransformEnumValues(
          (_typeName, _externalValue, valueConfig) => ['UNO', valueConfig],
        )
      ],
    });

    const query = `query Test($test: TestEnum) {
      test(argument: $test)
    }`;

    const result = await graphql(transformedSchema, query, undefined, undefined, { test: 'UNO' });
    expect(result.errors).toBeUndefined();
  });
});
