/* eslint-disable @typescript-eslint/triple-slash-reference */
/* eslint-disable spaced-comment */
/* eslint-disable node/no-deprecated-api */

///<reference path="declarations.d.ts" />

import { loadTypedefsSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { concatAST } from 'graphql';
import { isSome } from '@graphql-tools/utils';

const VALID_EXTENSIONS = ['graphql', 'graphqls', 'gql', 'gqls'];

export function handleModule(m: NodeModule, filename: string) {
  const sources = loadTypedefsSync(filename, {
    loaders: [new GraphQLFileLoader()],
  });

  const documents = sources.map(source => source.document).filter(isSome);
  const mergedDoc = concatAST(documents);
  m.exports = mergedDoc;
}

export function registerGraphQLExtensions(nodeRequire: NodeRequire) {
  for (const ext of VALID_EXTENSIONS) {
    nodeRequire.extensions[`.${ext}`] = handleModule;
  }
}

registerGraphQLExtensions(require);
