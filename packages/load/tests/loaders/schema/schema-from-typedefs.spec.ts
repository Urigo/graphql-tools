import { loadSchema, loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { runTests, useMonorepo } from '../../../../testing/utils';

const monorepo = useMonorepo({
  dirname: __dirname
});

function assertNonMaybe<T>(input: T): asserts input is Exclude<T, null | undefined>{
  if (input == null) {
    throw new Error("Value should be neither null nor undefined.")
  }
}

describe('schema from typedefs', () => {
  monorepo.correctCWD();

  runTests({
    async: loadSchema,
    sync: loadSchemaSync
  })(load => {
    it('should work with glob correctly', async () => {
      const glob = './tests/loaders/schema/test-files/schema-dir/query.graphql';
      const schema = await load(glob, {
        loaders: [new GraphQLFileLoader()]
      });

      expect(schema.getTypeMap().User).toBeDefined();
      expect(schema.getTypeMap().Query).toBeDefined();
    });

    it('should ignore empty files when using glob expressions', async () => {
      const glob = './tests/loaders/schema/test-files/schema-dir/*.empty.graphql';

      try {
        await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e.message).toContain(`Unable to find any GraphQL type definitions for the following pointers:`);
        expect(e.message).toContain(`/tests/loaders/schema/test-files/schema-dir/*.empty.graphql`);
      }
    });

    it('should point to a broken file with parsing error message', async () => {
      const glob = './tests/loaders/schema/test-files/schema-dir/*.broken.graphql';

      try {
        const schema = await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(schema).toBeFalsy();
      } catch (e) {
        expect(e.message).toContain(`Unable to find any GraphQL type definitions for the following pointers:`);
      }
    });

    it('should ignore graphql documents when loading a schema', async () => {
      const glob = './tests/loaders/schema/test-files/schema-dir/*.non-schema.graphql';

      try {
        await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e.message).toContain(`Unable to find any GraphQL type definitions for the following pointers:`);
        expect(e.message).toContain(`./tests/loaders/schema/test-files/schema-dir/*.non-schema.graphql`);
      }
    });

    it('should work with graphql-tag', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/*.ts';

      const schema = await load(schemaPath, {
        loaders: [new CodeFileLoader()]
      });

      expect(schema.getTypeMap().User).toBeDefined();
      expect(schema.getTypeMap().Query).toBeDefined();
    });

    it('should work without globs correctly', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/type-defs/graphql-tag.ts';
      const schema = await load(schemaPath, {
        loaders: [new CodeFileLoader()]
      });

      expect(schema.getTypeMap().User).toBeDefined();
      expect(schema.getTypeMap().Query).toBeDefined();
    });

    it('should work with import notations', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/query.graphql';
      const schema = await load(schemaPath, {
        loaders: [new GraphQLFileLoader()]
      });

      expect(schema.getTypeMap().User).toBeDefined();
      expect(schema.getTypeMap().Query).toBeDefined();
    });

    it('should work with extensions (static graphql file)', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/extensions/schema-with-extend.graphql';
      const schema = await load(schemaPath, {
        loaders: [new GraphQLFileLoader()]
      });
      const QueryType = schema.getQueryType()
      assertNonMaybe(QueryType)
      const queryFields = Object.keys(QueryType.getFields());

      expect(queryFields).toContain('foo');
      expect(queryFields).toContain('bar');
    });

    it('should work with extensions (multiple graphql files)', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/extensions/*.graphql';
      const schema = await load(schemaPath, {
        loaders: [new GraphQLFileLoader()]
      });
      const QueryType = schema.getQueryType()
      assertNonMaybe(QueryType)
      const queryFields = Object.keys(QueryType.getFields());

      expect(queryFields).toContain('foo');
      expect(queryFields).toContain('bar');
      expect(queryFields).toContain('baz');
    });

    it('should work with extensions (static js file with typedefs)', async () => {
      const schemaPath = './tests/loaders/schema/test-files/schema-dir/extensions/type-defs.js';
      const schema = await load(schemaPath, {
        loaders: [new CodeFileLoader()]
      });
      const QueryType = schema.getQueryType()
      assertNonMaybe(QueryType)
      const queryFields = Object.keys(QueryType.getFields());

      expect(queryFields).toContain('foo');
      expect(queryFields).toContain('bar');
    });

    it('should include sources on demand', async () => {
      const glob = './tests/loaders/schema/test-files/schema-dir/query.graphql';
      const schemaWithSources = await load(glob, {
        loaders: [new GraphQLFileLoader()],
        includeSources: true,
      });
      assertNonMaybe(schemaWithSources.extensions)
      expect(schemaWithSources.extensions.sources).toBeDefined();
      expect(schemaWithSources.extensions.sources).toHaveLength(1);
      expect(schemaWithSources.extensions.sources[0]).toMatchObject(expect.objectContaining({
        name: glob
      }))

      const schemaWithoutSources = await load(glob, {
        loaders: [new GraphQLFileLoader()]
      });
      assertNonMaybe(schemaWithoutSources.extensions)
      expect(schemaWithoutSources.extensions.sources).not.toBeDefined();
    });
  })
});
