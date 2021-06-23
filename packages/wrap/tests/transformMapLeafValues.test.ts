import { wrapSchema, MapLeafValues } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';
import { assertSome } from '@graphql-tools/utils';

describe('MapLeafValues', () => {
  test('works', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        enum TestEnum {
          ONE
          TWO
          THREE
        }

        type Query {
          testEnum(argument: TestEnum): TestEnum
          testScalar(argument: Int): Int
        }
      `,
      resolvers: {
        Query: {
          testEnum: (_root, { argument }) => argument,
          testScalar: (_root, { argument }) => argument,
        }
      }
    });

    const valueIterator = (typeName: string, value: any) => {
      if (typeName === 'TestEnum') {
        return value === 'ONE' ? 'TWO' : value === 'TWO' ? 'THREE' : 'ONE';
      } else if (typeName === 'Int') {
        return value + 5;
      } else {
        return value;
      }
    };

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new MapLeafValues(valueIterator, valueIterator),
      ],
    });

    const query = `{
      testEnum(argument: ONE)
      testScalar(argument: 5)
    }`;

    const result = await graphql(transformedSchema, query);
    assertSome(result.data)
    expect(result.data.testEnum).toBe('THREE');
    expect(result.data.testScalar).toBe(15);
  });
});
