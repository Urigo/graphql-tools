import { wrapSchema, RemoveObjectFieldDeprecations } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertGraphQLObjectType } from '../../testing/assertion';
import { assertSome } from '@graphql-tools/utils';

describe('RemoveObjectFieldDeprecations', () => {
  const originalSchema = makeExecutableSchema({
    typeDefs: `
      type Test {
        id: ID!
        first: String! @deprecated(reason: "do not remove")
        second: String! @deprecated(reason: "remove this")
      }
    `
  });

  test('removes deprecations by reason', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDeprecations('remove this')
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.first)
    expect(fields.first.deprecationReason).toEqual('do not remove');
    assertSome(fields.second)
    expect(fields.second.deprecationReason).toBeUndefined();
    expect(fields.first.astNode?.directives?.length).toEqual(1);
    expect(fields.second.astNode?.directives?.length).toEqual(0);
  });

  test('removes deprecations by reason regex', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDeprecations(/remove/)
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.first)
    expect(fields.first.deprecationReason).toBeUndefined();
    assertSome(fields.second)
    expect(fields.second.deprecationReason).toBeUndefined();
    expect(fields.first.astNode?.directives?.length).toEqual(0);
    expect(fields.second.astNode?.directives?.length).toEqual(0);
  });
});
