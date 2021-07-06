import {
  GraphQLSchema,
  GraphQLNamedType,
  GraphQLScalarType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  getNamedType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isInputObjectType,
} from 'graphql';

import { PruneSchemaOptions } from './types';

import { mapSchema } from './mapSchema';
import { MapperKind } from './Interfaces';
import { isSome } from './helpers';

type NamedOutputType =
  | GraphQLObjectType
  | GraphQLInterfaceType
  | GraphQLUnionType
  | GraphQLEnumType
  | GraphQLScalarType;
type NamedInputType = GraphQLInputObjectType | GraphQLEnumType | GraphQLScalarType;

interface PruningContext {
  schema: GraphQLSchema;
  unusedTypes: Record<string, boolean>;
  implementations: Record<string, Record<string, boolean>>;
}

/**
 * Prunes the provided schema, removing unused and empty types
 * @param schema The schema to prune
 * @param options Additional options for removing unused types from the schema
 */
export function pruneSchema(schema: GraphQLSchema, options: PruneSchemaOptions = {}): GraphQLSchema {
  const pruningContext: PruningContext = {
    schema,
    unusedTypes: Object.create(null),
    implementations: Object.create(null),
  };

  for (const typeName in schema.getTypeMap()) {
    const type = schema.getType(typeName);
    if (type && 'getInterfaces' in type) {
      for (const iface of type.getInterfaces()) {
        const implementations = getImplementations(pruningContext, iface);
        if (implementations == null) {
          pruningContext.implementations[iface.name] = Object.create(null);
        }
        pruningContext.implementations[iface.name][type.name] = true;
      }
    }
  }

  visitTypes(pruningContext, schema);

  return mapSchema(schema, {
    [MapperKind.TYPE]: (type: GraphQLNamedType) => {
      // If we should NOT prune the type, return it immediately as unmodified
      if (options.skipPruning && options.skipPruning(type)) {
        return type;
      }

      if (isObjectType(type) || isInputObjectType(type)) {
        if (
          (!Object.keys(type.getFields()).length && !options.skipEmptyCompositeTypePruning) ||
          (pruningContext.unusedTypes[type.name] && !options.skipUnusedTypesPruning)
        ) {
          return null;
        }
      } else if (isUnionType(type)) {
        if (
          (!type.getTypes().length && !options.skipEmptyUnionPruning) ||
          (pruningContext.unusedTypes[type.name] && !options.skipUnusedTypesPruning)
        ) {
          return null;
        }
      } else if (isInterfaceType(type)) {
        const implementations = getImplementations(pruningContext, type);

        if (
          (!Object.keys(type.getFields()).length && !options.skipEmptyCompositeTypePruning) ||
          (implementations && !Object.keys(implementations).length && !options.skipUnimplementedInterfacesPruning) ||
          (pruningContext.unusedTypes[type.name] && !options.skipUnusedTypesPruning)
        ) {
          return null;
        }
      } else {
        if (pruningContext.unusedTypes[type.name] && !options.skipUnusedTypesPruning) {
          return null;
        }
      }
    },
  });
}

function visitOutputType(
  visitedTypes: Record<string, boolean>,
  pruningContext: PruningContext,
  type: NamedOutputType
): void {
  if (visitedTypes[type.name]) {
    return;
  }

  visitedTypes[type.name] = true;
  pruningContext.unusedTypes[type.name] = false;

  if (isObjectType(type) || isInterfaceType(type)) {
    const fields = type.getFields();
    for (const fieldName in fields) {
      const field = fields[fieldName];
      const namedType = getNamedType(field.type) as NamedOutputType;
      visitOutputType(visitedTypes, pruningContext, namedType);

      for (const arg of field.args) {
        const type = getNamedType(arg.type) as NamedInputType;
        visitInputType(visitedTypes, pruningContext, type);
      }
    }

    if (isInterfaceType(type)) {
      const implementations = getImplementations(pruningContext, type);
      if (implementations) {
        for (const typeName in implementations) {
          visitOutputType(visitedTypes, pruningContext, pruningContext.schema.getType(typeName) as NamedOutputType);
        }
      }
    }

    if ('getInterfaces' in type) {
      for (const iFace of type.getInterfaces()) {
        visitOutputType(visitedTypes, pruningContext, iFace);
      }
    }
  } else if (isUnionType(type)) {
    const types = type.getTypes();
    for (const type of types) {
      visitOutputType(visitedTypes, pruningContext, type);
    }
  }
}

/**
 * Get the implementations of an interface. May return undefined.
 */
function getImplementations(
  pruningContext: PruningContext,
  type: GraphQLNamedType
): Record<string, boolean> | undefined {
  return pruningContext.implementations[type.name];
}

function visitInputType(
  visitedTypes: Record<string, boolean>,
  pruningContext: PruningContext,
  type: NamedInputType
): void {
  if (visitedTypes[type.name]) {
    return;
  }

  pruningContext.unusedTypes[type.name] = false;
  visitedTypes[type.name] = true;

  if (isInputObjectType(type)) {
    const fields = type.getFields();
    for (const fieldName in fields) {
      const field = fields[fieldName];
      const namedType = getNamedType(field.type) as NamedInputType;
      visitInputType(visitedTypes, pruningContext, namedType);
    }
  }
}

function visitTypes(pruningContext: PruningContext, schema: GraphQLSchema): void {
  for (const typeName in schema.getTypeMap()) {
    if (!typeName.startsWith('__')) {
      pruningContext.unusedTypes[typeName] = true;
    }
  }

  const visitedTypes: Record<string, boolean> = Object.create(null);

  const rootTypes = [schema.getQueryType(), schema.getMutationType(), schema.getSubscriptionType()].filter(isSome);

  for (const rootType of rootTypes) {
    visitOutputType(visitedTypes, pruningContext, rootType);
  }

  for (const directive of schema.getDirectives()) {
    for (const arg of directive.args) {
      const type = getNamedType(arg.type) as NamedInputType;
      visitInputType(visitedTypes, pruningContext, type);
    }
  }
}
