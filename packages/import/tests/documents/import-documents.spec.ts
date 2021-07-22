import '../../../testing/to-be-similar-gql-doc';
import { processImport, VisitedFilesMap } from '../../src';
import { print } from 'graphql';
import { relative } from 'path';

const importDocuments = (documentPath: string) => print(processImport(documentPath, __dirname));

describe('import in documents', () => {
  it('should get documents with default imports properly', () => {
    const document = importDocuments('./import-test/default/a.graphql');

    expect(document).toBeSimilarGqlDoc(/* GraphQL */ `
      query FooQuery {
        foo {
          ...FooFragment
        }
      }

      fragment FooFragment on Foo {
        bar {
          ...BarFragment
        }
      }

      fragment BarFragment on Bar {
        baz
      }
    `);
  });

  it('should get documents with default imports properly with comments', () => {
    const document = importDocuments('./import-test/default/with-comments.graphql');
    expect(document).toBeSimilarGqlDoc(
      /* GraphQL */ `
        # eslint-disable-next-line
        query Foo {
          ...BarFragment
        }

        fragment BarFragment on Bar {
          baz
        }
      `,
      { skipComments: false }
    );
  });

  it('should get documents with specific imports properly', () => {
    const document = importDocuments('./import-test/specific/a.graphql');

    expect(document).toBeSimilarGqlDoc(/* GraphQL */ `
      query FooQuery {
        foo {
          ...FooFragment
        }
      }

      fragment FooFragment on Foo {
        bar {
          ...BarFragment
        }
      }

      fragment BarFragment on Bar {
        baz
      }
    `);
  });

  it('should accept a map as fourth argument for users to get visited file paths with details', () => {
    const visitedFiles: VisitedFilesMap = new Map();
    processImport('./import-test/default/a.graphql', __dirname, undefined, visitedFiles);
    const relativePaths = Array.from(visitedFiles.keys())
      .map(absPath => relative(__dirname, absPath))
      .map(relPath => relPath.replace(/\\/g, '\/'));
    expect(relativePaths).toStrictEqual([
      'import-test/default/a.graphql',
      'import-test/default/b.graphql',
      'import-test/default/c.graphql',
    ]);
  });
});
