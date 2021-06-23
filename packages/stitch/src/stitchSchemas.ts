import {
  DocumentNode,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLDirective,
  specifiedDirectives,
  extendSchema,
} from 'graphql';

import { IResolvers, pruneSchema } from '@graphql-tools/utils';

import { addResolversToSchema, assertResolversPresent, extendResolversFromInterfaces } from '@graphql-tools/schema';

import { SubschemaConfig, isSubschemaConfig, Subschema, defaultMergedResolver } from '@graphql-tools/delegate';

import { IStitchSchemasOptions, SubschemaConfigTransform } from './types';

import { buildTypeCandidates, buildTypes } from './typeCandidates';
import { createStitchingInfo, completeStitchingInfo, addStitchingInfo } from './stitchingInfo';
import {
  defaultSubschemaConfigTransforms,
  isolateComputedFieldsTransformer,
  splitMergedTypeEntryPointsTransformer,
} from './subschemaConfigTransforms';
import { mergeResolvers } from '@graphql-tools/merge';

export function stitchSchemas<TContext = Record<string, any>>({
  subschemas = [],
  types = [],
  typeDefs,
  onTypeConflict,
  mergeDirectives,
  mergeTypes = true,
  typeMergingOptions,
  subschemaConfigTransforms = defaultSubschemaConfigTransforms,
  resolvers = {},
  inheritResolversFromInterfaces = false,
  resolverValidationOptions = {},
  schemaTransforms = [],
  parseOptions = {},
  pruningOptions,
  updateResolversInPlace,
}: IStitchSchemasOptions<TContext>): GraphQLSchema {
  if (typeof resolverValidationOptions !== 'object') {
    throw new Error('Expected `resolverValidationOptions` to be an object');
  }

  let transformedSubschemas: Array<Subschema<any, any, any, TContext>> = [];
  const subschemaMap: Map<
    GraphQLSchema | SubschemaConfig<any, any, any, TContext>,
    Subschema<any, any, any, TContext>
  > = new Map();
  const originalSubschemaMap: Map<
    Subschema<any, any, any, TContext>,
    GraphQLSchema | SubschemaConfig<any, any, any, TContext>
  > = new Map();

  subschemas.forEach(subschemaOrSubschemaArray => {
    if (Array.isArray(subschemaOrSubschemaArray)) {
      subschemaOrSubschemaArray.forEach(s => {
        transformedSubschemas = transformedSubschemas.concat(
          applySubschemaConfigTransforms(subschemaConfigTransforms, s, subschemaMap, originalSubschemaMap)
        );
      });
    } else {
      transformedSubschemas = transformedSubschemas.concat(
        applySubschemaConfigTransforms(
          subschemaConfigTransforms,
          subschemaOrSubschemaArray,
          subschemaMap,
          originalSubschemaMap
        )
      );
    }
  });

  const extensions: Array<DocumentNode> = [];
  const directives: Array<GraphQLDirective> = [];
  const directiveMap: Record<string, GraphQLDirective> = specifiedDirectives.reduce((acc, directive) => {
    acc[directive.name] = directive;
    return acc;
  }, Object.create(null));
  const schemaDefs = Object.create(null);
  const operationTypeNames = {
    query: 'Query',
    mutation: 'Mutation',
    subscription: 'Subscription',
  };

  const typeCandidates = buildTypeCandidates({
    subschemas: transformedSubschemas,
    originalSubschemaMap,
    types,
    typeDefs: typeDefs || [],
    parseOptions,
    extensions,
    directiveMap,
    schemaDefs,
    operationTypeNames,
    mergeDirectives,
  });

  Object.keys(directiveMap).forEach(directiveName => {
    directives.push(directiveMap[directiveName]);
  });

  let stitchingInfo = createStitchingInfo(subschemaMap, typeCandidates, mergeTypes);

  const { typeMap: newTypeMap, directives: newDirectives } = buildTypes({
    typeCandidates,
    directives,
    stitchingInfo,
    operationTypeNames,
    onTypeConflict,
    mergeTypes,
    typeMergingOptions,
  });

  let schema = new GraphQLSchema({
    query: newTypeMap[operationTypeNames.query] as GraphQLObjectType,
    mutation: newTypeMap[operationTypeNames.mutation] as GraphQLObjectType,
    subscription: newTypeMap[operationTypeNames.subscription] as GraphQLObjectType,
    types: Object.keys(newTypeMap).map(key => newTypeMap[key]),
    directives: newDirectives,
    astNode: schemaDefs.schemaDef,
    extensionASTNodes: schemaDefs.schemaExtensions,
    extensions: null,
  });

  extensions.forEach(extension => {
    schema = extendSchema(schema, extension, {
      commentDescriptions: true,
    });
  });

  // We allow passing in an array of resolver maps, in which case we merge them
  const resolverMap: IResolvers = mergeResolvers(resolvers);

  const finalResolvers = inheritResolversFromInterfaces
    ? extendResolversFromInterfaces(schema, resolverMap)
    : resolverMap;

  stitchingInfo = completeStitchingInfo(stitchingInfo, finalResolvers, schema);

  schema = addResolversToSchema({
    schema,
    defaultFieldResolver: defaultMergedResolver,
    resolvers: finalResolvers,
    resolverValidationOptions,
    inheritResolversFromInterfaces: false,
    updateResolversInPlace,
  });

  if (Object.keys(resolverValidationOptions).length > 0) {
    assertResolversPresent(schema, resolverValidationOptions);
  }

  schema = addStitchingInfo(schema, stitchingInfo);

  schemaTransforms.forEach(schemaTransform => {
    schema = schemaTransform(schema);
  });

  if (pruningOptions) {
    schema = pruneSchema(schema, pruningOptions);
  }

  return schema;
}

const subschemaConfigTransformerPresets: Array<SubschemaConfigTransform<any>> = [
  isolateComputedFieldsTransformer,
  splitMergedTypeEntryPointsTransformer,
];

function applySubschemaConfigTransforms<TContext = Record<string, any>>(
  subschemaConfigTransforms: Array<SubschemaConfigTransform<TContext>>,
  subschemaOrSubschemaConfig: GraphQLSchema | SubschemaConfig<any, any, any, TContext>,
  subschemaMap: Map<GraphQLSchema | SubschemaConfig<any, any, any, TContext>, Subschema<any, any, any, TContext>>,
  originalSubschemaMap: Map<
    Subschema<any, any, any, TContext>,
    GraphQLSchema | SubschemaConfig<any, any, any, TContext>
  >
): Array<Subschema<any, any, any, TContext>> {
  let subschemaConfig: SubschemaConfig;
  if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
    subschemaConfig = subschemaOrSubschemaConfig;
  } else if (subschemaOrSubschemaConfig instanceof GraphQLSchema) {
    subschemaConfig = { schema: subschemaOrSubschemaConfig };
  } else {
    throw new TypeError('Received invalid input.');
  }

  let transformedSubschemaConfigs: Array<SubschemaConfig<any, any, any, TContext>> = [subschemaConfig];
  subschemaConfigTransforms
    .concat(subschemaConfigTransformerPresets as Array<SubschemaConfigTransform<TContext>>)
    .forEach(subschemaConfigTransform => {
      const mapped: Array<SubschemaConfig<any, any, any, TContext> | Array<SubschemaConfig<any, any, any, TContext>>> =
        transformedSubschemaConfigs.map(ssConfig => subschemaConfigTransform(ssConfig));

      transformedSubschemaConfigs = mapped.reduce(
        (acc: Array<SubschemaConfig<any, any, any, TContext>>, configOrList) => {
          if (Array.isArray(configOrList)) {
            return acc.concat(configOrList);
          }
          acc.push(configOrList);
          return acc;
        },
        []
      );
    });

  const transformedSubschemas = transformedSubschemaConfigs.map(
    ssConfig => new Subschema<any, any, any, TContext>(ssConfig)
  );

  const baseSubschema = transformedSubschemas[0];

  subschemaMap.set(subschemaOrSubschemaConfig, baseSubschema);

  transformedSubschemas.forEach(subschema => originalSubschemaMap.set(subschema, subschemaOrSubschemaConfig));

  return transformedSubschemas;
}
