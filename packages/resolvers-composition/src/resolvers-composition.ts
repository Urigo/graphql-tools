import { chainFunctions } from './chain-functions';
import _ from 'lodash';
import { GraphQLFieldResolver, GraphQLScalarTypeConfig } from 'graphql';
import { asArray } from '@graphql-tools/utils';

export type ResolversComposition<
  Resolver extends GraphQLFieldResolver<any, any, any> = GraphQLFieldResolver<any, any>
> = (next: Resolver) => Resolver;

export type ResolversComposerMapping<Resolvers extends Record<string, any> = Record<string, any>> =
  | {
      [TypeName in keyof Resolvers]?: {
        [FieldName in keyof Resolvers[TypeName]]: Resolvers[TypeName][FieldName] extends GraphQLFieldResolver<any, any>
          ?
              | ResolversComposition<Resolvers[TypeName][FieldName]>
              | Array<ResolversComposition<Resolvers[TypeName][FieldName]>>
          : ResolversComposition | ResolversComposition[];
      };
    }
  | {
      [path: string]: ResolversComposition | ResolversComposition[];
    };

function isScalarTypeConfiguration(config: any): config is GraphQLScalarTypeConfig<any, any> {
  return config && 'serialize' in config && 'parseLiteral' in config;
}

function resolveRelevantMappings<Resolvers extends Record<string, any> = Record<string, any>>(
  resolvers: Resolvers,
  path: string,
  allMappings: ResolversComposerMapping<Resolvers>
): string[] {
  const split = path.split('.');

  if (split.length === 2) {
    const typeName = split[0];

    if (isScalarTypeConfiguration(resolvers[typeName])) {
      return [];
    }

    const fieldName = split[1];

    if (typeName === '*') {
      if (!resolvers) {
        return [];
      }
      return Object.keys(resolvers)
        .map(typeName => resolveRelevantMappings(resolvers, `${typeName}.${fieldName}`, allMappings))
        .flat();
    }

    if (fieldName === '*') {
      const fieldMap = resolvers[typeName];
      if (!fieldMap) {
        return [];
      }
      return Object.keys(fieldMap)
        .map(field => resolveRelevantMappings(resolvers, `${typeName}.${field}`, allMappings))
        .flat()
        .filter(mapItem => !allMappings[mapItem]);
    } else {
      const paths = [];

      if (resolvers[typeName] && resolvers[typeName][fieldName]) {
        if (resolvers[typeName][fieldName].subscribe) {
          paths.push(path + '.subscribe');
        }

        if (resolvers[typeName][fieldName].resolve) {
          paths.push(path + '.resolve');
        }

        if (typeof resolvers[typeName][fieldName] === 'function') {
          paths.push(path);
        }
      }

      return paths;
    }
  } else if (split.length === 1) {
    const typeName = split[0];

    const fieldMap = resolvers[typeName];
    if (!fieldMap) {
      return [];
    }

    return Object.keys(fieldMap)
      .map(fieldName => resolveRelevantMappings(resolvers, `${typeName}.${fieldName}`, allMappings))
      .flat();
  }

  return [];
}

/**
 * Wraps the resolvers object with the resolvers composition objects.
 * Implemented as a simple and basic middleware mechanism.
 *
 * @param resolvers - resolvers object
 * @param mapping - resolvers composition mapping
 * @hidden
 */
export function composeResolvers<Resolvers extends Record<string, any>>(
  resolvers: Resolvers,
  mapping: ResolversComposerMapping<Resolvers> = {}
): Resolvers {
  const mappingResult: { [path: string]: ((...args: any[]) => any)[] } = {};

  Object.keys(mapping).forEach((resolverPath: string) => {
    const resolverPathMapping = mapping[resolverPath];
    if (resolverPathMapping instanceof Array || typeof resolverPathMapping === 'function') {
      const composeFns = resolverPathMapping as ResolversComposition | ResolversComposition[];
      const relevantFields = resolveRelevantMappings(resolvers, resolverPath, mapping);

      relevantFields.forEach((path: string) => {
        mappingResult[path] = asArray(composeFns);
      });
    } else if (resolverPathMapping) {
      Object.keys(resolverPathMapping).forEach(fieldName => {
        const composeFns = resolverPathMapping[fieldName];
        const relevantFields = resolveRelevantMappings(resolvers, resolverPath + '.' + fieldName, mapping);

        for (const path of relevantFields) {
          mappingResult[path] = asArray(composeFns);
        }
      });
    }
  });

  for (const path in mappingResult) {
    const fns = chainFunctions([...asArray(mappingResult[path]), () => _.get(resolvers, path)]);

    _.set(resolvers, path, fns());
  }

  return resolvers;
}
