import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLFieldResolver,
} from 'graphql';

import { MapperKind, mapSchema } from '@graphql-tools/utils';

import { SubschemaConfig, defaultMergedResolver, applySchemaTransforms } from '@graphql-tools/delegate';
import { generateProxyingResolvers } from './generateProxyingResolvers';

export function wrapSchema<TConfig = Record<string, any>>(
  subschemaConfig: SubschemaConfig<any, any, any, TConfig>
): GraphQLSchema {
  const targetSchema = subschemaConfig.schema;

  const proxyingResolvers = generateProxyingResolvers(subschemaConfig);
  const schema = createWrappingSchema(targetSchema, proxyingResolvers);

  const transformedSchema = applySchemaTransforms(schema, subschemaConfig);

  return applySchemaTransforms(schema, subschemaConfig, transformedSchema);
}

function createWrappingSchema(
  schema: GraphQLSchema,
  proxyingResolvers: Record<string, Record<string, GraphQLFieldResolver<any, any>>>
) {
  return mapSchema(schema, {
    [MapperKind.ROOT_OBJECT]: type => {
      const config = type.toConfig();

      const fieldConfigMap = config.fields;
      for (const fieldName in fieldConfigMap) {
        const field = fieldConfigMap[fieldName];
        if (field == null) {
          continue;
        }
        fieldConfigMap[fieldName] = {
          ...field,
          ...proxyingResolvers[type.name]?.[fieldName],
        };
      }

      return new GraphQLObjectType(config);
    },
    [MapperKind.OBJECT_TYPE]: type => {
      const config = type.toConfig();
      config.isTypeOf = undefined;

      for (const fieldName in config.fields) {
        const field = config.fields[fieldName];
        if (field == null) {
          continue;
        }
        field.resolve = defaultMergedResolver;
        field.subscribe = undefined;
      }

      return new GraphQLObjectType(config);
    },
    [MapperKind.INTERFACE_TYPE]: type => {
      const config = type.toConfig();
      delete config.resolveType;
      return new GraphQLInterfaceType(config);
    },
    [MapperKind.UNION_TYPE]: type => {
      const config = type.toConfig();
      delete config.resolveType;
      return new GraphQLUnionType(config);
    },
  });
}
