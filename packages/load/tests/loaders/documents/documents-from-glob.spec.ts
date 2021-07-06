import { loadDocuments, loadDocumentsSync } from '@graphql-tools/load';
import { join } from 'path';
import { separateOperations } from 'graphql';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { runTests } from '../../../../testing/utils';

describe('documentsFromGlob', () => {
  runTests({
    async: loadDocuments,
    sync: loadDocumentsSync
  })(load => {
    test(`Should load one GraphQL document from glob expression`, async () => {
      const glob = join(__dirname, './test-files/', '*.query.graphql');
      const result = await load(glob, {
        loaders: [new GraphQLFileLoader()]
      });
      expect(result.length).toBe(1);
      expect(result[0].document).toBeDefined();
    });

    test(`Should load multiple GraphQL document from glob expression`, async () => {
      const glob = join(__dirname, './test-files/', '*.graphql');
      const result = await load(glob, {
        loaders: [new GraphQLFileLoader()]
      });
      expect(result.length).toBe(2);
      expect(result[0].document).toBeDefined();
      expect(result[1].document).toBeDefined();
    });

    test(`Should load two GraphQL documents both for gatsby and graphql-tag by default`, async () => {
      const glob = join(__dirname, './test-files/', 'tags.js');
      const result = await load(glob, {
        loaders: [new CodeFileLoader()]
      });
      const { document } = result[0];
      const operations = document && separateOperations(document);

      expect(operations && Object.keys(operations)).toHaveLength(2);
    });

    test(`Should load GraphQL documents that match custom settings`, async () => {
      const glob = join(__dirname, './test-files/', 'tags.js');

      const result = await load(glob, {
        pluckConfig: {
          modules: [
            {
              name: 'parse-graphql',
              identifier: 'parse',
            },
          ],
          globalGqlIdentifierName: 'somethingElse',
        },
        loaders: [
          new CodeFileLoader()
        ]
      });

      const { document } = result[0];
      const operations = document && separateOperations(document);

      expect(operations && Object.keys(operations)).toHaveLength(1);
    });

    test(`Should throw on syntax errors`, async () => {
      try {
        const glob = join(__dirname, './test-invalid-syntax/', 'invalid-syntax.query.graphql');
        await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeDefined();
        expect(e.message).toContain("Syntax Error");
      }
    });

    test(`Should throw on empty files and empty result`, async () => {
      try {
        const glob = join(__dirname, './test-files/', '*.empty.graphql');
        await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test(`Should throw on invalid files`, async () => {
      try {
        const glob = join(__dirname, './test-files/', 'invalid*.*.graphql');
        await load(glob, {
          loaders: [new GraphQLFileLoader()]
        });
        expect(true).toBeFalsy();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test(`Should ignore schema definitions`, async () => {
      const glob = join(__dirname, './test-files/', '*.graphql');
      const result = await load(glob, {
        loaders: [new GraphQLFileLoader()]
      });
      expect(result.length).toBe(2);
    });

    test(`Should ignore files that is added to ignore glob (using options.ignore)`, async () => {
      const glob = join(__dirname, './test-files/', '*.graphql');
      const ignoreGlob = join(__dirname, './test-files/', '*.query.graphql');
      const result = await load([glob], {
        ignore: ignoreGlob,
        loaders: [new GraphQLFileLoader()]
      });
      expect(result.length).toBe(1);
    });

    test(`Should ignore files that is added to ignore glob (using negative glob)`, async () => {
      const glob = join(__dirname, './test-files/', '*.graphql');
      const ignoreGlob = `!(${join(__dirname, './test-files/', '*.query.graphql')})`;
      const result = await load([glob, ignoreGlob], {
        loaders: [new GraphQLFileLoader()]
      });
      expect(result.length).toBe(1);
    });

    test(`should respect brackets in file path`, async () => {
      const glob = join(__dirname, './test-with-brackets/', '**/*.ts');
      const result = await load(glob, {
        loaders: [new CodeFileLoader()],
      });
      expect(result.length).toBe(1);
    });
  })
});
