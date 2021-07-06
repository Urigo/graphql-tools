import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';

import { getResponseKeyFromInfo, getRootTypeMap } from '@graphql-tools/utils';
import {
  delegateToSchema,
  getSubschema,
  resolveExternalValue,
  SubschemaConfig,
  ICreateProxyingResolverOptions,
  applySchemaTransforms,
  isExternalObject,
  getUnpathedErrors,
} from '@graphql-tools/delegate';

export function generateProxyingResolvers<TContext>(
  subschemaConfig: SubschemaConfig<any, any, any, TContext>
): Record<string, Record<string, GraphQLFieldResolver<any, any>>> {
  const targetSchema = subschemaConfig.schema;
  const createProxyingResolver = subschemaConfig.createProxyingResolver ?? defaultCreateProxyingResolver;

  const transformedSchema = applySchemaTransforms(targetSchema, subschemaConfig);

  const rootTypeMap = getRootTypeMap(targetSchema);

  const resolvers = {};
  for (const [operation, rootType] of rootTypeMap.entries()) {
    const typeName = rootType.name;
    const fields = rootType.getFields();

    resolvers[typeName] = {};
    for (const fieldName in fields) {
      const proxyingResolver = createProxyingResolver({
        subschemaConfig,
        transformedSchema,
        operation,
        fieldName,
      });

      const finalResolver = createPossiblyNestedProxyingResolver(subschemaConfig, proxyingResolver);

      if (operation === 'subscription') {
        resolvers[typeName][fieldName] = {
          subscribe: finalResolver,
          resolve: (payload: any, _: never, __: never, { fieldName: targetFieldName }: GraphQLResolveInfo) =>
            payload[targetFieldName],
        };
      } else {
        resolvers[typeName][fieldName] = {
          resolve: finalResolver,
        };
      }
    }
  }

  return resolvers;
}

function createPossiblyNestedProxyingResolver<TContext>(
  subschemaConfig: SubschemaConfig<any, any, any, TContext>,
  proxyingResolver: GraphQLFieldResolver<any, any>
): GraphQLFieldResolver<any, TContext, any> {
  return (parent, args, context, info) => {
    if (parent != null) {
      const responseKey = getResponseKeyFromInfo(info);

      // Check to see if the parent contains a proxied result
      if (isExternalObject(parent)) {
        const unpathedErrors = getUnpathedErrors(parent);
        const subschema = getSubschema(parent, responseKey);

        // If there is a proxied result from this subschema, return it
        // This can happen even for a root field when the root type ia
        // also nested as a field within a different type.
        if (subschemaConfig === subschema && parent[responseKey] !== undefined) {
          return resolveExternalValue(parent[responseKey], unpathedErrors, subschema, context, info);
        }
      }
    }

    return proxyingResolver(parent, args, context, info);
  };
}

export function defaultCreateProxyingResolver<TContext>({
  subschemaConfig,
  operation,
  transformedSchema,
}: ICreateProxyingResolverOptions<TContext>): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: subschemaConfig,
      operation,
      context,
      info,
      transformedSchema,
    });
}
