import { GraphQLSchema, DocumentNode, buildASTSchema, BuildSchemaOptions, buildSchema } from 'graphql';
import { addResolversToSchema } from '@graphql-tools/schema';
import { mergeTypeDefs, Config } from './typedefs-mergers/merge-typedefs';
import { mergeResolvers } from './merge-resolvers';
import {
  IResolvers,
  IResolverValidationOptions,
  asArray,
  getResolversFromSchema,
  TypeSource,
} from '@graphql-tools/utils';
import { mergeExtensions, extractExtensionsFromSchema, applyExtensions, SchemaExtensions } from './extensions';

/**
 * Configuration object for schema merging
 */
export interface MergeSchemasConfig<Resolvers extends IResolvers = IResolvers> extends Config, BuildSchemaOptions {
  /**
   * The schemas to be merged
   */
  schemas: GraphQLSchema[];
  /**
   * Additional type definitions to also merge
   */
  typeDefs?: TypeSource;
  /**
   * Additional resolvers to also merge
   */
  resolvers?: Resolvers | Resolvers[];
  /**
   * Options to validate the resolvers being merged, if provided
   */
  resolverValidationOptions?: IResolverValidationOptions;
}

const defaultResolverValidationOptions: Partial<IResolverValidationOptions> = {
  requireResolversForArgs: 'ignore',
  requireResolversForNonScalar: 'ignore',
  requireResolversForAllFields: 'ignore',
  requireResolversForResolveType: 'ignore',
  requireResolversToMatchSchema: 'ignore',
};

/**
 * Synchronously merges multiple schemas, typeDefinitions and/or resolvers into a single schema.
 * @param config Configuration object
 */
export function mergeSchemas(config: MergeSchemasConfig) {
  const typeDefs = mergeTypeDefs([config.schemas, config.typeDefs || []], config);
  const extractedResolvers: IResolvers<any, any>[] = [];
  const extractedExtensions: SchemaExtensions[] = [];
  for (const schema of config.schemas) {
    extractedResolvers.push(getResolversFromSchema(schema));
    extractedExtensions.push(extractExtensionsFromSchema(schema));
  }
  extractedResolvers.push(...ensureResolvers(config));

  const resolvers = mergeResolvers(extractedResolvers, config);
  const extensions = mergeExtensions(extractedExtensions);

  return makeSchema({ resolvers, typeDefs, extensions }, config);
}

/**
 * Asynchronously merges multiple schemas, typeDefinitions and/or resolvers into a single schema.
 * @param config Configuration object
 */
export async function mergeSchemasAsync(config: MergeSchemasConfig) {
  const [typeDefs, resolvers, extensions] = await Promise.all([
    mergeTypeDefs([config.schemas, config.typeDefs || []], config),
    Promise.all(config.schemas.map(async schema => getResolversFromSchema(schema))).then(extractedResolvers =>
      mergeResolvers([...extractedResolvers, ...ensureResolvers(config)], config)
    ),
    Promise.all(config.schemas.map(async schema => extractExtensionsFromSchema(schema))).then(extractedExtensions =>
      mergeExtensions(extractedExtensions)
    ),
  ]);

  return makeSchema({ resolvers, typeDefs, extensions }, config);
}

function ensureResolvers(config: MergeSchemasConfig) {
  return config.resolvers ? asArray<IResolvers>(config.resolvers) : [];
}

function makeSchema(
  {
    resolvers,
    typeDefs,
    extensions,
  }: { resolvers: IResolvers; typeDefs: string | DocumentNode; extensions: SchemaExtensions },
  config: MergeSchemasConfig
) {
  let schema = typeof typeDefs === 'string' ? buildSchema(typeDefs, config) : buildASTSchema(typeDefs, config);

  // add resolvers
  if (resolvers) {
    schema = addResolversToSchema({
      schema,
      resolvers,
      resolverValidationOptions: {
        ...defaultResolverValidationOptions,
        ...(config.resolverValidationOptions || {}),
      },
    });
  }

  // extensions
  applyExtensions(schema, extensions);

  return schema;
}
