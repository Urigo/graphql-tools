import { chainFunctions } from './chain-functions';
import _ from 'lodash';
import { GraphQLFieldResolver, GraphQLScalarTypeConfig } from 'graphql';
import { asArray } from '@graphql-tools/utils';
import { matcher } from 'micromatch';

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
  path: string
): string[] {
  if (!resolvers) {
    return [];
  }

  const [typeNameOrGlob, fieldNameOrGlob] = path.split('.');
  const isTypeMatch = matcher(typeNameOrGlob);

  let fixedFieldGlob = fieldNameOrGlob;
  // convert single value OR `{singleField}` to `singleField` as matching will fail otherwise
  if (fixedFieldGlob.includes('{') && !fixedFieldGlob.includes(',')) {
    fixedFieldGlob = fieldNameOrGlob.replace('{', '').replace('}', '');
  }
  fixedFieldGlob = fixedFieldGlob.replace(', ', ',').trim();

  const isFieldMatch = matcher(fixedFieldGlob);

  const mappings: string[] = [];
  for (const typeName in resolvers) {
    if (!isTypeMatch(typeName)) {
      continue;
    }

    if (isScalarTypeConfiguration(resolvers[typeName])) {
      continue;
    }

    const fieldMap = resolvers[typeName];
    if (!fieldMap) {
      return [];
    }

    for (const field in fieldMap) {
      if (!isFieldMatch(field)) {
        continue;
      }

      const resolvedPath = `${typeName}.${field}`;

      if (resolvers[typeName] && resolvers[typeName][field]) {
        if (resolvers[typeName][field].subscribe) {
          mappings.push(resolvedPath + '.subscribe');
        }

        if (resolvers[typeName][field].resolve) {
          mappings.push(resolvedPath + '.resolve');
        }

        if (typeof resolvers[typeName][field] === 'function') {
          mappings.push(resolvedPath);
        }
      }
    }
  }

  return mappings;
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

  for (const resolverPath in mapping) {
    const resolverPathMapping = mapping[resolverPath];
    if (resolverPathMapping instanceof Array || typeof resolverPathMapping === 'function') {
      const composeFns = resolverPathMapping as ResolversComposition | ResolversComposition[];
      const relevantFields = resolveRelevantMappings(resolvers, resolverPath);

      for (const path of relevantFields) {
        mappingResult[path] = asArray(composeFns);
      }
    } else if (resolverPathMapping) {
      for (const fieldName in resolverPathMapping) {
        const composeFns = resolverPathMapping[fieldName];
        const relevantFields = resolveRelevantMappings(resolvers, resolverPath + '.' + fieldName);

        for (const path of relevantFields) {
          mappingResult[path] = asArray(composeFns);
        }
      }
    }
  }

  for (const path in mappingResult) {
    const fns = chainFunctions([...asArray(mappingResult[path]), () => _.get(resolvers, path)]);

    _.set(resolvers, path, fns());
  }

  return resolvers;
}
