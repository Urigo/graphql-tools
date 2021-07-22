import { ASTNode, parse, DocumentNode, DefinitionNode, print } from 'graphql';
import { compareNodes } from '@graphql-tools/utils';
import prettier from 'prettier';

declare global {
  namespace jest {
    interface Matchers<R, T> {
      /**
       * Normalizes whitespace and performs string comparisons
       */
      toBeSimilarGqlDoc(expected: string, { skipComments }?: { skipComments: boolean }): R;
    }
  }
}

function sortRecursive(a: ASTNode) {
  for (const attr in a) {
    if (a[attr] instanceof Array) {
      if (a[attr].length === 1) {
        sortRecursive(a[attr][0]);
      }
      a[attr].sort((b: ASTNode, c: ASTNode) => {
        sortRecursive(b);
        sortRecursive(c);
        return compareNodes(b, c);
      });
    }
  }
}

function normalizeDocumentString(docStr: string, skipComments: boolean) {
  if (!skipComments) {
    return prettier.format(docStr, { parser: 'graphql' });
  }

  const doc = parse(docStr, { noLocation: true }) as DocumentNode & { definitions: DefinitionNode[] };
  sortRecursive(doc);
  return print(doc);
}

expect.extend({
  toBeSimilarGqlDoc(received: string, expected: string, { skipComments } = { skipComments: true }) {
    const strippedReceived = normalizeDocumentString(received, skipComments);
    const strippedExpected = normalizeDocumentString(expected, skipComments);

    if (strippedReceived.trim() === strippedExpected.trim()) {
      return {
        message: () =>
          `expected
${received}
not to be a string containing (ignoring indents)
${expected}`,
        pass: true,
      };
    }

    return {
      message: () =>
        `expected
${received}
to be a string containing (ignoring indents)
${expected}`,
      pass: false,
    };
  },
});
