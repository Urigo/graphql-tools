import { getNamedType, GraphQLOutputType, GraphQLList } from 'graphql';
import { delegateToSchema, MergedTypeResolver, MergedTypeResolverOptions } from '@graphql-tools/delegate';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';

export function createMergedTypeResolver(
  mergedTypeResolverOptions: MergedTypeResolverOptions
): MergedTypeResolver | undefined {
  const { fieldName, argsFromKeys, valuesFromResults, args } = mergedTypeResolverOptions;

  if (argsFromKeys != null) {
    return (originalResult, context, info, subschema, selectionSet, key) =>
      batchDelegateToSchema({
        schema: subschema,
        operation: 'query',
        fieldName,
        returnType: new GraphQLList(
          getNamedType(info.schema.getType(originalResult.__typename) ?? info.returnType) as GraphQLOutputType
        ),
        key,
        argsFromKeys,
        valuesFromResults,
        selectionSet,
        context,
        info,
        skipTypeMerging: true,
      });
  }

  if (args != null) {
    return (originalResult, context, info, subschema, selectionSet) =>
      delegateToSchema({
        schema: subschema,
        operation: 'query',
        fieldName,
        returnType: getNamedType(
          info.schema.getType(originalResult.__typename) ?? info.returnType
        ) as GraphQLOutputType,
        args: args(originalResult),
        selectionSet,
        context,
        info,
        skipTypeMerging: true,
      });
  }

  return undefined;
}
