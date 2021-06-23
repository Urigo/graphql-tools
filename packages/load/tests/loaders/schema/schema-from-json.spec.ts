import { loadSchema, loadSchemaSync } from '@graphql-tools/load';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { isSchema } from 'graphql';
import { runTests, useMonorepo } from '../../../../testing/utils';

const monorepo = useMonorepo({
  dirname: __dirname,
});

function assertNonMaybe<T>(input: T): asserts input is Exclude<T, null | undefined>{
  if (input == null) {
    throw new Error("Value should be neither null nor undefined.")
  }
}

describe('Schema From Export', () => {
  monorepo.correctCWD();

  runTests({
    async: loadSchema,
    sync: loadSchemaSync
  })(load => {
    it('should load the schema correctly from an introspection file', async () => {
      const schema = await load('./tests/loaders/schema/test-files/githunt.json', {
        loaders: [new JsonFileLoader()]
      });
      expect(isSchema(schema)).toBeTruthy();
    });
    it('should load the schema with correct descriptions', async () => {
      const schema = await load('./tests/loaders/schema/test-files/githunt.json', {
        loaders: [new JsonFileLoader()]
      });
      expect(isSchema(schema)).toBeTruthy();
      const introspectionSchema = require('./test-files/githunt.json').__schema;
      for (const typeName in schema.getTypeMap()) {
        if (!typeName.startsWith('__')) {
          const type = schema.getType(typeName);
          assertNonMaybe(type)
          const introspectionType = introspectionSchema.types.find((t: { name: string; }) => t.name === typeName);
          if (type.description || introspectionType.description) {
            expect(type.description).toBe(introspectionType.description);
          }
          if ('getFields' in type) {
            const fieldMap = type.getFields();
            for (const fieldName in fieldMap) {
              const field = fieldMap[fieldName];
              const introspectionField = introspectionType.fields.find((f: { name: string; }) => f.name === fieldName);
              if (field.description || introspectionField.description) {
                assertNonMaybe(field.description)
                expect(field.description.trim()).toBe(introspectionField.description.trim());
              }
            }
          }
        }
      }
    });
  })
});
