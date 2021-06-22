import { printSchemaWithDirectives, SchemaPrintOptions } from '@graphql-tools/utils';
import { parse, GraphQLSchema, DefinitionNode, DocumentNode, ParseOptions, concatAST } from 'graphql';

import { transform as skipRedundantNodesTransform } from 'relay-compiler/lib/transforms/SkipRedundantNodesTransform';
import { transformWithOptions as inlineFragmentsTransformWithOptions } from 'relay-compiler/lib/transforms/InlineFragmentsTransform';
import { transform as applyFragmentArgumentTransform } from 'relay-compiler/lib/transforms/ApplyFragmentArgumentTransform';
import { transformWithOptions as flattenTransformWithOptions } from 'relay-compiler/lib/transforms/FlattenTransform';
import CompilerContext from 'relay-compiler/lib/core/CompilerContext';
import { transform as relayTransform } from 'relay-compiler/lib/core/RelayParser';
import { print as relayPrint } from 'relay-compiler/lib/core/IRPrinter';
import { create as relayCreate } from 'relay-compiler/lib/core/Schema';

export type OptimizeDocumentsOptions = SchemaPrintOptions &
  ParseOptions & {
    includeFragments?: boolean;
  };

export function optimizeDocuments(
  schema: GraphQLSchema,
  documents: DocumentNode[],
  options: OptimizeDocumentsOptions = {}
) {
  options = {
    noLocation: true,
    ...options,
  };
  // @TODO way for users to define directives they use, otherwise relay will throw an unknown directive error
  // Maybe we can scan the queries and add them dynamically without users having to do some extra stuff
  // transformASTSchema creates a new schema instance instead of mutating the old one
  const adjustedSchema = relayCreate(printSchemaWithDirectives(schema, options));

  const documentAsts = concatAST(documents);

  const relayDocuments = relayTransform(adjustedSchema, documentAsts.definitions as DefinitionNode[]);

  const result: DocumentNode[] = [];

  const queryCompilerContext = new CompilerContext(adjustedSchema)
    .addAll(relayDocuments)
    .applyTransforms([
      applyFragmentArgumentTransform,
      inlineFragmentsTransformWithOptions({ includeFragments: options.includeFragments }),
      flattenTransformWithOptions({ flattenAbstractTypes: false }),
      skipRedundantNodesTransform,
    ]);

  result.push(...queryCompilerContext.documents().map(doc => parse(relayPrint(adjustedSchema, doc), options)));

  return result;
}
