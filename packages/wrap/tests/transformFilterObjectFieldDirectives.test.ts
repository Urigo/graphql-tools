import { wrapSchema, FilterObjectFieldDirectives } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';

describe('FilterObjectFieldDirectives', () => {
  test('removes unmatched field directives', async () => {
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

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new FilterObjectFieldDirectives((dirName: string, dirValue: any) => dirName === 'keep' && dirValue.arg !== 1)
      ],
    });

    const fields = transformedSchema.getQueryType()?.getFields();
    expect(fields?.['alpha']?.astNode?.directives?.length).toEqual(0);
    expect(fields?.['bravo']?.astNode?.directives?.length).toEqual(1);
    expect(fields?.['charlie']?.astNode?.directives?.length).toEqual(0);
    expect(fields?.['delta']?.astNode?.directives?.length).toEqual(1);
  });
});
