import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  GraphQLSchema,
} from 'graphql';

import { MapperKind, FieldFilter, RootFieldFilter, TypeFilter } from './Interfaces';

import { mapSchema } from './mapSchema';

import { Constructor } from './types';

export function filterSchema({
  schema,
  rootFieldFilter = () => true,
  typeFilter = () => true,
  fieldFilter = () => true,
  objectFieldFilter = () => true,
  interfaceFieldFilter = () => true,
}: {
  schema: GraphQLSchema;
  rootFieldFilter?: RootFieldFilter;
  typeFilter?: TypeFilter;
  fieldFilter?: FieldFilter;
  objectFieldFilter?: FieldFilter;
  interfaceFieldFilter?: FieldFilter;
}): GraphQLSchema {
  const filteredSchema: GraphQLSchema = mapSchema(schema, {
    [MapperKind.QUERY]: (type: GraphQLObjectType) => filterRootFields(type, 'Query', rootFieldFilter),
    [MapperKind.MUTATION]: (type: GraphQLObjectType) => filterRootFields(type, 'Mutation', rootFieldFilter),
    [MapperKind.SUBSCRIPTION]: (type: GraphQLObjectType) => filterRootFields(type, 'Subscription', rootFieldFilter),
    [MapperKind.OBJECT_TYPE]: (type: GraphQLObjectType) =>
      typeFilter(type.name, type)
        ? filterElementFields<GraphQLObjectType>(type, objectFieldFilter || fieldFilter, GraphQLObjectType)
        : null,
    [MapperKind.INTERFACE_TYPE]: (type: GraphQLInterfaceType) =>
      typeFilter(type.name, type)
        ? filterElementFields<GraphQLInterfaceType>(type, interfaceFieldFilter, GraphQLInterfaceType)
        : null,
    [MapperKind.UNION_TYPE]: (type: GraphQLUnionType) => (typeFilter(type.name, type) ? undefined : null),
    [MapperKind.INPUT_OBJECT_TYPE]: (type: GraphQLInputObjectType) => (typeFilter(type.name, type) ? undefined : null),
    [MapperKind.ENUM_TYPE]: (type: GraphQLEnumType) => (typeFilter(type.name, type) ? undefined : null),
    [MapperKind.SCALAR_TYPE]: (type: GraphQLScalarType) => (typeFilter(type.name, type) ? undefined : null),
  });

  return filteredSchema;
}

function filterRootFields(
  type: GraphQLObjectType,
  operation: 'Query' | 'Mutation' | 'Subscription',
  rootFieldFilter: RootFieldFilter
): GraphQLObjectType {
  const config = type.toConfig();
  Object.keys(config.fields).forEach(fieldName => {
    if (!rootFieldFilter(operation, fieldName, config.fields[fieldName])) {
      delete config.fields[fieldName];
    }
  });
  return new GraphQLObjectType(config);
}

function filterElementFields<ElementType>(
  type: GraphQLObjectType | GraphQLInterfaceType,
  fieldFilter: FieldFilter,
  ElementConstructor: Constructor<ElementType>
): ElementType {
  const config = type.toConfig();
  Object.keys(config.fields).forEach(fieldName => {
    if (!fieldFilter(type.name, fieldName, config.fields[fieldName])) {
      delete config.fields[fieldName];
    }
  });
  return new ElementConstructor(config);
}
