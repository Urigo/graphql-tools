import {
  DocumentNode,
  GraphQLNamedType,
  getNamedType,
  isNamedType,
  GraphQLDirective,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  isSpecifiedScalarType,
  GraphQLSchema,
  isDirective,
  GraphQLObjectType,
  OperationTypeNode,
} from 'graphql';

import { wrapSchema } from '@graphql-tools/wrap';
import { Subschema, SubschemaConfig, StitchingInfo } from '@graphql-tools/delegate';
import { GraphQLParseOptions, TypeSource, rewireTypes, getRootTypeMap } from '@graphql-tools/utils';

import typeFromAST from './typeFromAST';
import { MergeTypeCandidate, MergeTypeFilter, OnTypeConflict, TypeMergingOptions } from './types';
import { mergeCandidates } from './mergeCandidates';
import { extractDefinitions } from './definitions';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { TypeMap } from 'graphql/type/schema';

type CandidateSelector<TContext = Record<string, any>> = (
  candidates: Array<MergeTypeCandidate<TContext>>
) => MergeTypeCandidate<TContext>;

export function buildTypeCandidates<TContext = Record<string, any>>({
  subschemas,
  originalSubschemaMap,
  types,
  typeDefs,
  parseOptions,
  extensions,
  directiveMap,
  schemaDefs,
  mergeDirectives,
}: {
  subschemas: Array<Subschema<any, any, any, TContext>>;
  originalSubschemaMap: Map<
    Subschema<any, any, any, TContext>,
    GraphQLSchema | SubschemaConfig<any, any, any, TContext>
  >;
  types: Array<GraphQLNamedType>;
  typeDefs: TypeSource;
  parseOptions: GraphQLParseOptions;
  extensions: Array<DocumentNode>;
  directiveMap: Record<string, GraphQLDirective>;
  schemaDefs: {
    schemaDef: SchemaDefinitionNode;
    schemaExtensions: Array<SchemaExtensionNode>;
  };
  mergeDirectives?: boolean | undefined;
}): [Record<string, Array<MergeTypeCandidate<TContext>>>, Record<OperationTypeNode, string>] {
  const typeCandidates: Record<string, Array<MergeTypeCandidate<TContext>>> = Object.create(null);

  let schemaDef: SchemaDefinitionNode | undefined;
  let schemaExtensions: Array<SchemaExtensionNode> = [];

  let document: DocumentNode | undefined;
  let extraction: ReturnType<typeof extractDefinitions> | undefined;
  if ((typeDefs && !Array.isArray(typeDefs)) || (Array.isArray(typeDefs) && typeDefs.length)) {
    document = mergeTypeDefs(typeDefs, parseOptions);
    extraction = extractDefinitions(document);
    schemaDef = extraction.schemaDefs[0];
    schemaExtensions = schemaExtensions.concat(extraction.schemaExtensions);
  }

  schemaDefs.schemaDef = schemaDef ?? schemaDefs.schemaDef;
  schemaDefs.schemaExtensions = schemaExtensions;

  const rootTypeNameMap = getRootTypeNameMap(schemaDefs);

  for (const subschema of subschemas) {
    const schema = wrapSchema(subschema);

    const rootTypeMap = getRootTypeMap(schema);
    const rootTypes = Array.from(rootTypeMap.values());

    for (const [operation, rootType] of rootTypeMap.entries()) {
      addTypeCandidate(typeCandidates, rootTypeNameMap[operation], {
        type: rootType,
        subschema: originalSubschemaMap.get(subschema),
        transformedSubschema: subschema,
      });
    }

    if (mergeDirectives === true) {
      for (const directive of schema.getDirectives()) {
        directiveMap[directive.name] = directive;
      }
    }

    const originalTypeMap = schema.getTypeMap();
    for (const typeName in originalTypeMap) {
      const type: GraphQLNamedType = originalTypeMap[typeName];
      if (
        isNamedType(type) &&
        getNamedType(type).name.slice(0, 2) !== '__' &&
        !rootTypes.includes(type as GraphQLObjectType)
      ) {
        addTypeCandidate(typeCandidates, type.name, {
          type,
          subschema: originalSubschemaMap.get(subschema),
          transformedSubschema: subschema,
        });
      }
    }
  }

  if (document != null && extraction != null) {
    for (const def of extraction.typeDefinitions) {
      const type = typeFromAST(def);
      if (!isNamedType(type)) {
        throw new Error(`Expected to get named typed but got ${JSON.stringify(def)}`);
      }
      if (type != null) {
        addTypeCandidate(typeCandidates, type.name, { type });
      }
    }

    for (const def of extraction.directiveDefs) {
      const directive = typeFromAST(def);
      if (!isDirective(directive)) {
        throw new Error(`Expected to get directive type but got ${JSON.stringify(def)}`);
      }
      directiveMap[directive.name] = directive;
    }

    if (extraction.extensionDefs.length > 0) {
      extensions.push({
        ...document,
        definitions: extraction.extensionDefs,
      });
    }
  }

  for (const type of types) {
    addTypeCandidate(typeCandidates, type.name, { type });
  }

  return [typeCandidates, rootTypeNameMap];
}

function getRootTypeNameMap({
  schemaDef,
  schemaExtensions,
}: {
  schemaDef: SchemaDefinitionNode;
  schemaExtensions: Array<SchemaExtensionNode>;
}): Record<OperationTypeNode, string> {
  const rootTypeNameMap: Record<OperationTypeNode, string> = {
    query: 'Query',
    mutation: 'Mutation',
    subscription: 'Subscription',
  };

  const allNodes: Array<SchemaDefinitionNode | SchemaExtensionNode> = schemaExtensions.slice();
  if (schemaDef != null) {
    allNodes.unshift(schemaDef);
  }

  for (const node of allNodes) {
    if (node.operationTypes != null) {
      for (const operationType of node.operationTypes) {
        rootTypeNameMap[operationType.operation] = operationType.type.name.value;
      }
    }
  }

  return rootTypeNameMap;
}

function addTypeCandidate<TContext = Record<string, any>>(
  typeCandidates: Record<string, Array<MergeTypeCandidate<TContext>>>,
  name: string,
  typeCandidate: MergeTypeCandidate<TContext>
) {
  if (!(name in typeCandidates)) {
    typeCandidates[name] = [];
  }
  typeCandidates[name].push(typeCandidate);
}

export function buildTypes<TContext = Record<string, any>>({
  typeCandidates,
  directives,
  stitchingInfo,
  rootTypeNames,
  onTypeConflict,
  mergeTypes,
  typeMergingOptions,
}: {
  typeCandidates: Record<string, Array<MergeTypeCandidate<TContext>>>;
  directives: Array<GraphQLDirective>;
  stitchingInfo: StitchingInfo<TContext>;
  rootTypeNames: Array<string>;
  onTypeConflict?: OnTypeConflict<TContext>;
  mergeTypes: boolean | Array<string> | MergeTypeFilter<TContext>;
  typeMergingOptions?: TypeMergingOptions<TContext>;
}): { typeMap: TypeMap; directives: Array<GraphQLDirective> } {
  const typeMap: TypeMap = Object.create(null);

  for (const typeName in typeCandidates) {
    if (
      rootTypeNames.includes(typeName) ||
      (mergeTypes === true && !typeCandidates[typeName].some(candidate => isSpecifiedScalarType(candidate.type))) ||
      (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
      (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
      (stitchingInfo != null && typeName in stitchingInfo.mergedTypes)
    ) {
      typeMap[typeName] = mergeCandidates(typeName, typeCandidates[typeName], typeMergingOptions);
    } else {
      const candidateSelector =
        onTypeConflict != null
          ? onTypeConflictToCandidateSelector(onTypeConflict)
          : (cands: Array<MergeTypeCandidate<TContext>>) => cands[cands.length - 1];
      typeMap[typeName] = candidateSelector(typeCandidates[typeName]).type;
    }
  }

  return rewireTypes(typeMap, directives);
}

function onTypeConflictToCandidateSelector<TContext = Record<string, any>>(
  onTypeConflict: OnTypeConflict<TContext>
): CandidateSelector<TContext> {
  return cands =>
    cands.reduce((prev, next) => {
      const type = onTypeConflict(prev.type, next.type, {
        left: {
          subschema: prev.subschema,
          transformedSubschema: prev.transformedSubschema,
        },
        right: {
          subschema: next.subschema,
          transformedSubschema: next.transformedSubschema,
        },
      });
      if (prev.type === type) {
        return prev;
      } else if (next.type === type) {
        return next;
      }
      return {
        schemaName: 'unknown',
        type,
      };
    });
}
