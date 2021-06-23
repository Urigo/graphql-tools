import { loadTypedefs, LoadTypedefsOptions, UnnormalizedTypeDefPointer, loadTypedefsSync } from './load-typedefs';
import { GraphQLSchema, BuildSchemaOptions, DocumentNode, Source as GraphQLSource, print } from 'graphql';
import { OPERATION_KINDS } from './documents';
import { mergeSchemasAsync, mergeSchemas, MergeSchemasConfig } from '@graphql-tools/merge';
import { Source } from '@graphql-tools/utils';

export type LoadSchemaOptions = BuildSchemaOptions &
  LoadTypedefsOptions &
  Partial<MergeSchemasConfig> & {
    /**
     * Adds a list of Sources in to `extensions.sources`
     *
     * Disabled by default.
     */
    includeSources?: boolean;
  };

/**
 * Asynchronously loads a schema from the provided pointers.
 * @param schemaPointers Pointers to the sources to load the schema from
 * @param options Additional options
 */
export async function loadSchema(
  schemaPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadSchemaOptions
): Promise<GraphQLSchema> {
  const sources = await loadTypedefs(schemaPointers, {
    filterKinds: OPERATION_KINDS,
    ...options,
  });

  const { schemas, typeDefs } = collectSchemasAndTypeDefs(sources);
  const mergeSchemasOptions: MergeSchemasConfig = {
    schemas,
    typeDefs,
    ...options,
  };

  const schema = await mergeSchemasAsync(mergeSchemasOptions);

  if (options?.includeSources) {
    includeSources(schema, sources);
  }

  return schema;
}

/**
 * Synchronously loads a schema from the provided pointers.
 * @param schemaPointers Pointers to the sources to load the schema from
 * @param options Additional options
 */
export function loadSchemaSync(
  schemaPointers: UnnormalizedTypeDefPointer | UnnormalizedTypeDefPointer[],
  options: LoadSchemaOptions
): GraphQLSchema {
  const sources = loadTypedefsSync(schemaPointers, {
    filterKinds: OPERATION_KINDS,
    ...options,
  });

  const { schemas, typeDefs } = collectSchemasAndTypeDefs(sources);
  const mergeSchemasOptions: MergeSchemasConfig = {
    schemas,
    typeDefs,
    ...options,
  };

  const schema = mergeSchemas(mergeSchemasOptions);

  if (options?.includeSources) {
    includeSources(schema, sources);
  }

  return schema;
}

function includeSources(schema: GraphQLSchema, sources: Source[]) {
  const finalSources: Array<GraphQLSource> = [];
  for (const source of sources) {
    if (source.rawSDL) {
      finalSources.push(new GraphQLSource(source.rawSDL, source.location));
    } else if (source.document) {
      finalSources.push(new GraphQLSource(print(source.document), source.location));
    }
  }
  schema.extensions = {
    ...schema.extensions,
    sources: finalSources,
  };
}

function collectSchemasAndTypeDefs(sources: Source[]) {
  const schemas: GraphQLSchema[] = [];
  const typeDefs: DocumentNode[] = [];

  for (const source of sources) {
    if (source.schema) {
      schemas.push(source.schema);
    } else if (source.document) {
      typeDefs.push(source.document);
    }
  }

  return {
    schemas,
    typeDefs,
  };
}
