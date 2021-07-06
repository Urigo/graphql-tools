import { wrapSchema, RemoveObjectFieldsWithDeprecation } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertGraphQLObjectType } from '../../testing/assertion';

describe('RemoveObjectFieldsWithDeprecation', () => {
  const originalSchema = makeExecutableSchema({
    typeDefs: `
      type Test {
        id: ID!
        first: String! @deprecated(reason: "do not remove")
        second: String! @deprecated(reason: "remove this")
      }
    `
  });

  test('removes deprecated fields by reason', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldsWithDeprecation('remove this')
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    expect(fields['first']).toBeDefined();
    expect(fields['second']).toBeUndefined();
  });

  test('removes deprecated fields by reason regex', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldsWithDeprecation(/remove/)
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    expect(fields['first']).toBeUndefined();
    expect(fields['second']).toBeUndefined();
  });
});
