import { wrapSchema, FilterFieldDirectives } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';

describe('FilterFieldDirectives', () => {
  test('removes fields with unqualified directives', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        directive @remove on FIELD_DEFINITION
        directive @keep(arg: Int) on FIELD_DEFINITION
        type Query {
          alpha:String @remove
          bravo:String @keep
          charlie:String @keep(arg:1)
          delta:String @keep(arg:2)
        }
      `
    });

    const transformedSchema = wrapSchema(schema, [
      new FilterFieldDirectives((dirName: string, dirValue: any) => dirName === 'keep' && dirValue.arg !== 1)
    ]);

    const fields = transformedSchema.getType('Query').getFields();
    expect(fields.alpha.astNode.directives.length).toEqual(0);
    expect(fields.bravo.astNode.directives.length).toEqual(1);
    expect(fields.charlie.astNode.directives.length).toEqual(0);
    expect(fields.delta.astNode.directives.length).toEqual(1);
  });
});
