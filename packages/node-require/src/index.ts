/* eslint-disable @typescript-eslint/triple-slash-reference */
/* eslint-disable spaced-comment */
/* eslint-disable node/no-deprecated-api */

///<reference path="declarations.d.ts" />

import { loadTypedefsSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { concatAST } from 'graphql';
import { isSome } from '@graphql-tools/utils';

const VALID_EXTENSIONS = ['graphql', 'graphqls', 'gql', 'gqls'];

function handleModule(m: NodeModule, filename: string) {
  console.log(m, filename);
  const sources = loadTypedefsSync(filename, {
    loaders: [new GraphQLFileLoader()],
  });

  const documents = sources.map(source => source.document).filter(isSome);
  const mergedDoc = concatAST(documents);
  m.exports = mergedDoc;
}

export function registerGraphQLExtensions(require: NodeRequire) {
  VALID_EXTENSIONS.forEach(ext => {
    require.extensions[`.${ext}`] = handleModule;
  });
}

registerGraphQLExtensions(require);
