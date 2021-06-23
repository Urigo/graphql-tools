import { GraphQLSchema } from 'graphql';

import {
  TypeSource,
  IResolvers,
  IResolverValidationOptions,
  GraphQLParseOptions,
  PruneSchemaOptions,
} from '@graphql-tools/utils';

/**
 * Configuration object for creating an executable schema
 */
export interface IExecutableSchemaDefinition<TContext = any> {
  /**
   * The type definitions used to create the schema
   */
  typeDefs: TypeSource;
  /**
   * Object describing the field resolvers for the provided type definitions
   */
  resolvers?: IResolvers<any, TContext> | Array<IResolvers<any, TContext>>;
  /**
   * Additional options for validating the provided resolvers
   */
  resolverValidationOptions?: IResolverValidationOptions;
  /**
   * An array of schema transformation functions
   */
  schemaTransforms?: ExecutableSchemaTransformation[];
  /**
   * Additional options for parsing the type definitions if they are provided
   * as a string
   */
  parseOptions?: GraphQLParseOptions;
  /**
   * GraphQL object types that implement interfaces will inherit any missing
   * resolvers from their interface types defined in the `resolvers` object
   */
  inheritResolversFromInterfaces?: boolean;
  /**
   * Additional options for removing unused types from the schema
   */
  pruningOptions?: PruneSchemaOptions;
  /**
   * Do not create a schema again and use the one from `buildASTSchema`
   */
  updateResolversInPlace?: boolean;
}

export type ExecutableSchemaTransformation = (schema: GraphQLSchema) => GraphQLSchema;
