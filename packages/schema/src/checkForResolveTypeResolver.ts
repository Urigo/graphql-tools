import { GraphQLSchema } from 'graphql';

import { MapperKind, mapSchema, ValidatorBehavior } from '@graphql-tools/utils';

// If we have any union or interface types throw if no there is no resolveType resolver
export function checkForResolveTypeResolver(schema: GraphQLSchema, requireResolversForResolveType?: ValidatorBehavior) {
  mapSchema(schema, {
    [MapperKind.ABSTRACT_TYPE]: type => {
      if (!type.resolveType) {
        const message =
          `Type "${type.name}" is missing a "__resolveType" resolver. Pass 'ignore' into ` +
          '"resolverValidationOptions.requireResolversForResolveType" to disable this error.';
        if (requireResolversForResolveType === 'error') {
          throw new Error(message);
        }

        if (requireResolversForResolveType === 'warn') {
          // eslint-disable-next-line no-console
          console.warn(message);
        }
      }
      return undefined;
    },
  });
}
