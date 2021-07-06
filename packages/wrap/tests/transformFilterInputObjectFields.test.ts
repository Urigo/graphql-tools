import { wrapSchema, FilterInputObjectFields } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, astFromValue, Kind, GraphQLString } from 'graphql';
import { assertSome } from '@graphql-tools/utils';

describe('FilterInputObjectFields', () => {
  test('filtering works', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        input InputObject {
          field1: String
          field2: String
        }

        type OutputObject {
          field1: String
          field2: String
        }

        type Query {
          test(argument: InputObject): OutputObject
        }
      `,
      resolvers: {
        Query: {
          test: (_root, args) => {
            return args.argument;
          }
        }
      }
    });

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new FilterInputObjectFields(
          (typeName, fieldName) => (typeName !== 'InputObject' || fieldName !== 'field2'),
          (typeName, inputObjectNode) => {
            if (typeName === 'InputObject') {
              const value = astFromValue('field2', GraphQLString)
              assertSome(value)
              return {
                ...inputObjectNode,
                fields: [...inputObjectNode.fields, {
                  kind: Kind.OBJECT_FIELD,
                  name: {
                    kind: Kind.NAME,
                    value: 'field2',
                  },
                  value,
                }],
              };
            }
          }
        )
      ],
    });

    const query = `{
      test(argument: {
        field1: "field1"
      }) {
        field1
        field2
      }
    }`;

    const result = await graphql(transformedSchema, query);
    assertSome(result.data)
    expect(result.data['test'].field1).toBe('field1');
    expect(result.data['test'].field2).toBe('field2');
  });
});
