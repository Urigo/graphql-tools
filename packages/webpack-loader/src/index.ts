import os from 'os';
import { isExecutableDefinitionNode, Kind, DocumentNode } from 'graphql';
import { uniqueCode } from '@graphql-tools/webpack-loader-runtime';
import { parseDocument } from './parser';
import { optimizeDocumentNode, removeDescriptions, removeEmptyNodes } from '@graphql-tools/optimize';
import type { LoaderContext } from 'webpack';

function isSDL(doc: DocumentNode) {
  return !doc.definitions.some(def => isExecutableDefinitionNode(def));
}

interface Options {
  noDescription?: boolean;
  noEmptyNodes?: boolean;
  noLoc?: boolean;
  replaceKinds?: boolean;
  esModule?: boolean;
  importHelpers?: boolean;
}

function expandImports(source: string, options: Options) {
  const lines = source.split(/\r\n|\r|\n/);
  let outputCode = options.importHelpers
    ? `
    var useUnique = require('@graphql-tools/webpack-loader-runtime').useUnique;
    var unique = useUnique();
  `
    : `
    ${uniqueCode}
  `;

  lines.some(line => {
    if (line[0] === '#' && line.slice(1).split(' ')[0] === 'import') {
      const importFile = line.slice(1).split(' ')[1];
      const parseDocument = `require(${importFile})`;
      const appendDef = `doc.definitions = doc.definitions.concat(unique(${parseDocument}.definitions));`;
      outputCode += appendDef + os.EOL;
    }
    return line.length !== 0 && line[0] !== '#';
  });

  return outputCode;
}

export default function graphqlLoader(this: LoaderContext<Options>, source: string) {
  this.cacheable();
  // TODO: This should probably use this.getOptions()
  const options = (this.query as Options) || {};
  let doc = parseDocument(source);

  const optimizers = [];

  if (options.noDescription) {
    optimizers.push(removeDescriptions);
  }
  if (options.noEmptyNodes) {
    optimizers.push(removeEmptyNodes);
  }

  if (optimizers.length > 0 && isSDL(doc)) {
    doc = optimizeDocumentNode(doc, optimizers);
  }

  let stringifiedDoc = JSON.stringify(doc);

  if (options.replaceKinds) {
    Object.keys(Kind).forEach(identifier => {
      const value = Kind[identifier as keyof typeof Kind];
      stringifiedDoc = stringifiedDoc.replace(new RegExp(`"kind":"${value}"`, 'g'), `"kind": Kind.${identifier}`);
    });
  }

  const headerCode = `
    ${options.replaceKinds ? "var Kind = require('graphql/language/kinds');" : ''}
    var doc = ${stringifiedDoc};
  `;

  let outputCode = '';

  // Allow multiple query/mutation definitions in a file. This parses out dependencies
  // at compile time, and then uses those at load time to create minimal query documents
  // We cannot do the latter at compile time due to how the #import code works.
  const operationCount = doc.definitions.reduce<number>((accum, op) => {
    if (op.kind === Kind.OPERATION_DEFINITION) {
      return accum + 1;
    }

    return accum;
  }, 0);

  function exportDefaultStatement(identifier: string) {
    if (options.esModule) {
      return `export default ${identifier}`;
    }

    return `module.exports = ${identifier}`;
  }

  if (operationCount > 1) {
    throw new Error('GraphQL Webpack Loader allows only for one GraphQL Operation per file');
  }

  outputCode += `
    ${exportDefaultStatement('doc')}
  `;

  const importOutputCode = expandImports(source, options);
  const allCode = [headerCode, importOutputCode, outputCode, ''].join(os.EOL);

  return allCode;
}
