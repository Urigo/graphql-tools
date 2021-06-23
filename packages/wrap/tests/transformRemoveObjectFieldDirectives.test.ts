import { wrapSchema, RemoveObjectFieldDirectives } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertGraphQLObjectType } from '../../testing/assertion';
import { assertSome } from '@graphql-tools/utils';

describe('RemoveObjectFieldDirectives', () => {
  const originalSchema = makeExecutableSchema({
    typeDefs: `
      directive @alpha(arg: String) on FIELD_DEFINITION
      directive @bravo(arg: String) on FIELD_DEFINITION

      type Test {
        id: ID! @bravo(arg: "remove this")
        first: String! @alpha(arg: "do not remove")
        second: String! @alpha(arg: "remove this")
        third: String @alpha(arg: "remove this")
      }
    `
  });

  test('removes directives by name', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDirectives('alpha')
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.id)
    expect(fields.id.astNode?.directives?.length).toEqual(1);
    assertSome(fields.first)
    expect(fields.first.astNode?.directives?.length).toEqual(0);
    assertSome(fields.second)
    expect(fields.second.astNode?.directives?.length).toEqual(0);
    assertSome(fields.third)
    expect(fields.third.astNode?.directives?.length).toEqual(0);
  });

  test('removes directives by name regex', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDirectives(/^alp/)
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.id)
    expect(fields.id.astNode?.directives?.length).toEqual(1);
    assertSome(fields.first)
    expect(fields.first.astNode?.directives?.length).toEqual(0);
    assertSome(fields.second)
    expect(fields.second.astNode?.directives?.length).toEqual(0);
    assertSome(fields.third)
    expect(fields.third.astNode?.directives?.length).toEqual(0);
  });

  test('removes directives by argument', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDirectives(/.+/, { arg: 'remove this' })
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.id)
    expect(fields.id.astNode?.directives?.length).toEqual(0);
    assertSome(fields.first)
    expect(fields.first.astNode?.directives?.length).toEqual(1);
    assertSome(fields.second)
    expect(fields.second.astNode?.directives?.length).toEqual(0);
    assertSome(fields.third)
    expect(fields.third.astNode?.directives?.length).toEqual(0);
  });

  test('removes directives by argument regex', async () => {
    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RemoveObjectFieldDirectives(/.+/, { arg: /remove/ })
      ],
    });

    const Test = transformedSchema.getType('Test')
    assertGraphQLObjectType(Test)
    const fields = Test.getFields();
    assertSome(fields.id)
    expect(fields.id.astNode?.directives?.length).toEqual(0);
    assertSome(fields.first)
    expect(fields.first.astNode?.directives?.length).toEqual(0);
    assertSome(fields.second)
    expect(fields.second.astNode?.directives?.length).toEqual(0);
    assertSome(fields.third)
    expect(fields.third.astNode?.directives?.length).toEqual(0);
  });
});
