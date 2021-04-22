import {
  GraphQLDirective,
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLSchema,
  GraphQLType,
  isInterfaceType,
  isEnumType,
  isObjectType,
  isScalarType,
  isUnionType,
  isInputObjectType,
  GraphQLFieldConfig,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLInputFieldConfig,
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLInputObjectTypeConfig,
  isLeafType,
  isListType,
  isNonNullType,
  isNamedType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLEnumType,
  InputValueDefinitionNode,
  FieldDefinitionNode,
  Kind,
  EnumValueDefinitionNode,
} from 'graphql';

import {
  SchemaMapper,
  MapperKind,
  TypeMap,
  NamedTypeMapper,
  DirectiveMapper,
  GenericFieldMapper,
  IDefaultValueIteratorFn,
  ArgumentMapper,
  EnumValueMapper,
} from './Interfaces';

import { rewireTypes } from './rewire';
import { serializeInputValue, parseInputValue } from './transformInputValue';
import { copyCustomFields } from './copy-custom-type-fields';

export function mapSchema(schema: GraphQLSchema, schemaMapper: SchemaMapper = {}): GraphQLSchema {
  const originalTypeMap = schema.getTypeMap();

  let newTypeMap = mapDefaultValues(originalTypeMap, schema, serializeInputValue);
  newTypeMap = mapTypes(newTypeMap, schema, schemaMapper, type => isLeafType(type));
  newTypeMap = mapEnumValues(newTypeMap, schema, schemaMapper);
  newTypeMap = mapDefaultValues(newTypeMap, schema, parseInputValue);

  newTypeMap = mapTypes(newTypeMap, schema, schemaMapper, type => !isLeafType(type));
  newTypeMap = mapFields(newTypeMap, schema, schemaMapper);
  newTypeMap = mapArguments(newTypeMap, schema, schemaMapper);

  const originalDirectives = schema.getDirectives();
  const newDirectives = mapDirectives(originalDirectives, schema, schemaMapper);

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  const newQueryTypeName =
    queryType != null ? (newTypeMap[queryType.name] != null ? newTypeMap[queryType.name].name : undefined) : undefined;
  const newMutationTypeName =
    mutationType != null
      ? newTypeMap[mutationType.name] != null
        ? newTypeMap[mutationType.name].name
        : undefined
      : undefined;
  const newSubscriptionTypeName =
    subscriptionType != null
      ? newTypeMap[subscriptionType.name] != null
        ? newTypeMap[subscriptionType.name].name
        : undefined
      : undefined;

  const { typeMap, directives } = rewireTypes(newTypeMap, newDirectives);

  return new GraphQLSchema({
    ...schema.toConfig(),
    query: newQueryTypeName ? (typeMap[newQueryTypeName] as GraphQLObjectType) : undefined,
    mutation: newMutationTypeName ? (typeMap[newMutationTypeName] as GraphQLObjectType) : undefined,
    subscription: newSubscriptionTypeName != null ? (typeMap[newSubscriptionTypeName] as GraphQLObjectType) : undefined,
    types: Object.keys(typeMap).map(typeName => typeMap[typeName]),
    directives,
  });
}

function mapTypes(
  originalTypeMap: TypeMap,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
  testFn: (originalType: GraphQLNamedType) => boolean = () => true
): TypeMap {
  const newTypeMap = {};

  Object.keys(originalTypeMap).forEach(typeName => {
    if (!typeName.startsWith('__')) {
      const originalType = originalTypeMap[typeName];

      if (originalType == null || !testFn(originalType)) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const typeMapper = getTypeMapper(schema, schemaMapper, typeName);

      if (typeMapper == null) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const maybeNewType = typeMapper(originalType, schema);

      if (maybeNewType === undefined) {
        newTypeMap[typeName] = originalType;
        return;
      }

      newTypeMap[typeName] = copyCustomFields(originalType, maybeNewType);
    }
  });

  return newTypeMap;
}

function mapEnumValues(originalTypeMap: TypeMap, schema: GraphQLSchema, schemaMapper: SchemaMapper): TypeMap {
  const enumValueMapper = getEnumValueMapper(schemaMapper);
  if (!enumValueMapper) {
    return originalTypeMap;
  }

  return mapTypes(
    originalTypeMap,
    schema,
    {
      [MapperKind.ENUM_TYPE]: type => {
        const config = type.toConfig();
        const originalEnumValueConfigMap = config.values;
        const newEnumValueConfigMap = {};
        Object.keys(originalEnumValueConfigMap).forEach(externalValue => {
          const originalEnumValueConfig = originalEnumValueConfigMap[externalValue];
          const mappedEnumValue = enumValueMapper(originalEnumValueConfig, type.name, schema, externalValue);
          if (mappedEnumValue === undefined) {
            newEnumValueConfigMap[externalValue] = originalEnumValueConfig;
          } else if (Array.isArray(mappedEnumValue)) {
            const [newExternalValue, newEnumValueConfig] = mappedEnumValue;
            newEnumValueConfigMap[newExternalValue] =
              newEnumValueConfig === undefined ? originalEnumValueConfig : newEnumValueConfig;
          } else if (mappedEnumValue !== null) {
            newEnumValueConfigMap[externalValue] = mappedEnumValue;
          }
        });
        return correctASTNodes(
          new GraphQLEnumType({
            ...config,
            values: newEnumValueConfigMap,
          })
        );
      },
    },
    type => isEnumType(type)
  );
}

function mapDefaultValues(originalTypeMap: TypeMap, schema: GraphQLSchema, fn: IDefaultValueIteratorFn): TypeMap {
  const newTypeMap = mapArguments(originalTypeMap, schema, {
    [MapperKind.ARGUMENT]: argumentConfig => {
      if (argumentConfig.defaultValue === undefined) {
        return argumentConfig;
      }

      const maybeNewType = getNewType(originalTypeMap, argumentConfig.type);
      if (maybeNewType != null) {
        return {
          ...argumentConfig,
          defaultValue: fn(maybeNewType, argumentConfig.defaultValue),
        };
      }
    },
  });

  return mapFields(newTypeMap, schema, {
    [MapperKind.INPUT_OBJECT_FIELD]: inputFieldConfig => {
      if (inputFieldConfig.defaultValue === undefined) {
        return inputFieldConfig;
      }

      const maybeNewType = getNewType(newTypeMap, inputFieldConfig.type);
      if (maybeNewType != null) {
        return {
          ...inputFieldConfig,
          defaultValue: fn(maybeNewType, inputFieldConfig.defaultValue),
        };
      }
    },
  });
}

function getNewType<T extends GraphQLType>(newTypeMap: TypeMap, type: T): T | null {
  if (isListType(type)) {
    const newType = getNewType(newTypeMap, type.ofType);
    return newType != null ? (new GraphQLList(newType) as T) : null;
  } else if (isNonNullType(type)) {
    const newType = getNewType(newTypeMap, type.ofType);
    return newType != null ? (new GraphQLNonNull(newType) as T) : null;
  } else if (isNamedType(type)) {
    const newType = newTypeMap[type.name];
    return newType != null ? (newType as T) : null;
  }

  return null;
}

function mapFields(originalTypeMap: TypeMap, schema: GraphQLSchema, schemaMapper: SchemaMapper): TypeMap {
  const newTypeMap = {};

  Object.keys(originalTypeMap).forEach(typeName => {
    if (!typeName.startsWith('__')) {
      const originalType = originalTypeMap[typeName];

      if (!isObjectType(originalType) && !isInterfaceType(originalType) && !isInputObjectType(originalType)) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const fieldMapper = getFieldMapper(schema, schemaMapper, typeName);
      if (fieldMapper == null) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const config = originalType.toConfig();

      const originalFieldConfigMap = config.fields;
      const newFieldConfigMap = {};
      Object.keys(originalFieldConfigMap).forEach(fieldName => {
        const originalFieldConfig = originalFieldConfigMap[fieldName];
        const mappedField = fieldMapper(originalFieldConfig, fieldName, typeName, schema);
        if (mappedField === undefined) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
        } else if (Array.isArray(mappedField)) {
          const [newFieldName, newFieldConfig] = mappedField;
          if (newFieldConfig.astNode != null) {
            newFieldConfig.astNode = {
              ...newFieldConfig.astNode,
              name: {
                ...newFieldConfig.astNode.name,
                value: newFieldName,
              },
            };
          }
          newFieldConfigMap[newFieldName] = newFieldConfig === undefined ? originalFieldConfig : newFieldConfig;
        } else if (mappedField !== null) {
          newFieldConfigMap[fieldName] = mappedField;
        }
      });

      if (isObjectType(originalType)) {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLObjectType({
            ...(config as GraphQLObjectTypeConfig<any, any>),
            fields: newFieldConfigMap,
          })
        );
      } else if (isInterfaceType(originalType)) {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLInterfaceType({
            ...(config as GraphQLInterfaceTypeConfig<any, any>),
            fields: newFieldConfigMap,
          })
        );
      } else {
        newTypeMap[typeName] = correctASTNodes(
          new GraphQLInputObjectType({
            ...(config as GraphQLInputObjectTypeConfig),
            fields: newFieldConfigMap,
          })
        );
      }
    }
  });

  return newTypeMap;
}

function mapArguments(originalTypeMap: TypeMap, schema: GraphQLSchema, schemaMapper: SchemaMapper): TypeMap {
  const newTypeMap = {};

  Object.keys(originalTypeMap).forEach(typeName => {
    if (!typeName.startsWith('__')) {
      const originalType = originalTypeMap[typeName];

      if (!isObjectType(originalType) && !isInterfaceType(originalType)) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const argumentMapper = getArgumentMapper(schemaMapper);
      if (argumentMapper == null) {
        newTypeMap[typeName] = originalType;
        return;
      }

      const config = originalType.toConfig();

      const originalFieldConfigMap = config.fields;
      const newFieldConfigMap = {};
      Object.keys(originalFieldConfigMap).forEach(fieldName => {
        const originalFieldConfig = originalFieldConfigMap[fieldName];
        const originalArgumentConfigMap = originalFieldConfig.args;

        if (originalArgumentConfigMap == null) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
          return;
        }

        const argumentNames = Object.keys(originalArgumentConfigMap);

        if (!argumentNames.length) {
          newFieldConfigMap[fieldName] = originalFieldConfig;
          return;
        }

        const newArgumentConfigMap = {};

        argumentNames.forEach(argumentName => {
          const originalArgumentConfig = originalArgumentConfigMap[argumentName];

          const mappedArgument = argumentMapper(originalArgumentConfig, fieldName, typeName, schema);

          if (mappedArgument === undefined) {
            newArgumentConfigMap[argumentName] = originalArgumentConfig;
          } else if (Array.isArray(mappedArgument)) {
            const [newArgumentName, newArgumentConfig] = mappedArgument;
            newArgumentConfigMap[newArgumentName] = newArgumentConfig;
          } else if (mappedArgument !== null) {
            newArgumentConfigMap[argumentName] = mappedArgument;
          }
        });
        newFieldConfigMap[fieldName] = {
          ...originalFieldConfig,
          args: newArgumentConfigMap,
        };
      });

      if (isObjectType(originalType)) {
        newTypeMap[typeName] = copyCustomFields(originalType, new GraphQLObjectType({
          ...((config as unknown) as GraphQLObjectTypeConfig<any, any>),
          fields: newFieldConfigMap,
        }));
      } else if (isInterfaceType(originalType)) {
        newTypeMap[typeName] = new GraphQLInterfaceType({
          ...((config as unknown) as GraphQLInterfaceTypeConfig<any, any>),
          fields: newFieldConfigMap,
        });
      } else {
        newTypeMap[typeName] = new GraphQLInputObjectType({
          ...((config as unknown) as GraphQLInputObjectTypeConfig),
          fields: newFieldConfigMap,
        });
      }
    }
  });

  return newTypeMap;
}

function mapDirectives(
  originalDirectives: ReadonlyArray<GraphQLDirective>,
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper
): Array<GraphQLDirective> {
  const directiveMapper = getDirectiveMapper(schemaMapper);
  if (directiveMapper == null) {
    return originalDirectives.slice();
  }

  const newDirectives: Array<GraphQLDirective> = [];

  originalDirectives.forEach(directive => {
    const mappedDirective = directiveMapper(directive, schema);
    if (mappedDirective === undefined) {
      newDirectives.push(directive);
    } else if (mappedDirective !== null) {
      newDirectives.push(mappedDirective);
    }
  });

  return newDirectives;
}

function getTypeSpecifiers(schema: GraphQLSchema, typeName: string): Array<MapperKind> {
  const type = schema.getType(typeName);
  const specifiers = [MapperKind.TYPE];

  if (isObjectType(type)) {
    specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.OBJECT_TYPE);
    const query = schema.getQueryType();
    const mutation = schema.getMutationType();
    const subscription = schema.getSubscriptionType();
    if (query != null && typeName === query.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.QUERY);
    } else if (mutation != null && typeName === mutation.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.MUTATION);
    } else if (subscription != null && typeName === subscription.name) {
      specifiers.push(MapperKind.ROOT_OBJECT, MapperKind.SUBSCRIPTION);
    }
  } else if (isInputObjectType(type)) {
    specifiers.push(MapperKind.INPUT_OBJECT_TYPE);
  } else if (isInterfaceType(type)) {
    specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.ABSTRACT_TYPE, MapperKind.INTERFACE_TYPE);
  } else if (isUnionType(type)) {
    specifiers.push(MapperKind.COMPOSITE_TYPE, MapperKind.ABSTRACT_TYPE, MapperKind.UNION_TYPE);
  } else if (isEnumType(type)) {
    specifiers.push(MapperKind.ENUM_TYPE);
  } else if (isScalarType(type)) {
    specifiers.push(MapperKind.SCALAR_TYPE);
  }

  return specifiers;
}

function getTypeMapper(schema: GraphQLSchema, schemaMapper: SchemaMapper, typeName: string): NamedTypeMapper | null {
  const specifiers = getTypeSpecifiers(schema, typeName);
  let typeMapper: NamedTypeMapper | undefined;
  const stack = [...specifiers];
  while (!typeMapper && stack.length > 0) {
    const next = stack.pop();
    typeMapper = schemaMapper[next] as NamedTypeMapper;
  }

  return typeMapper != null ? typeMapper : null;
}

function getFieldSpecifiers(schema: GraphQLSchema, typeName: string): Array<MapperKind> {
  const type = schema.getType(typeName);
  const specifiers = [MapperKind.FIELD];

  if (isObjectType(type)) {
    specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.OBJECT_FIELD);
    const query = schema.getQueryType();
    const mutation = schema.getMutationType();
    const subscription = schema.getSubscriptionType();
    if (query != null && typeName === query.name) {
      specifiers.push(MapperKind.ROOT_FIELD, MapperKind.QUERY_ROOT_FIELD);
    } else if (mutation != null && typeName === mutation.name) {
      specifiers.push(MapperKind.ROOT_FIELD, MapperKind.MUTATION_ROOT_FIELD);
    } else if (subscription != null && typeName === subscription.name) {
      specifiers.push(MapperKind.ROOT_FIELD, MapperKind.SUBSCRIPTION_ROOT_FIELD);
    }
  } else if (isInterfaceType(type)) {
    specifiers.push(MapperKind.COMPOSITE_FIELD, MapperKind.INTERFACE_FIELD);
  } else if (isInputObjectType(type)) {
    specifiers.push(MapperKind.INPUT_OBJECT_FIELD);
  }

  return specifiers;
}

function getFieldMapper<F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig>(
  schema: GraphQLSchema,
  schemaMapper: SchemaMapper,
  typeName: string
): GenericFieldMapper<F> | null {
  const specifiers = getFieldSpecifiers(schema, typeName);
  let fieldMapper: GenericFieldMapper<F> | undefined;
  const stack = [...specifiers];
  while (!fieldMapper && stack.length > 0) {
    const next = stack.pop();
    fieldMapper = schemaMapper[next] as GenericFieldMapper<F>;
  }

  return fieldMapper != null ? fieldMapper : null;
}

function getArgumentMapper(schemaMapper: SchemaMapper): ArgumentMapper | null {
  const argumentMapper = schemaMapper[MapperKind.ARGUMENT];
  return argumentMapper != null ? argumentMapper : null;
}

function getDirectiveMapper(schemaMapper: SchemaMapper): DirectiveMapper | null {
  const directiveMapper = schemaMapper[MapperKind.DIRECTIVE];
  return directiveMapper != null ? directiveMapper : null;
}

function getEnumValueMapper(schemaMapper: SchemaMapper): EnumValueMapper | null {
  const enumValueMapper = schemaMapper[MapperKind.ENUM_VALUE];
  return enumValueMapper != null ? enumValueMapper : null;
}

export function correctASTNodes(type: GraphQLObjectType): GraphQLObjectType;
export function correctASTNodes(type: GraphQLInterfaceType): GraphQLInterfaceType;
export function correctASTNodes(type: GraphQLInputObjectType): GraphQLInputObjectType;
export function correctASTNodes(type: GraphQLEnumType): GraphQLEnumType;
export function correctASTNodes(type: GraphQLNamedType): GraphQLNamedType {
  if (isObjectType(type)) {
    const config = (type as GraphQLObjectType).toConfig();
    if (config.astNode != null) {
      const fields: Array<FieldDefinitionNode> = [];
      Object.values(config.fields).forEach(fieldConfig => {
        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      });
      config.astNode = {
        ...config.astNode,
        kind: Kind.OBJECT_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map(node => ({
        ...node,
        kind: Kind.OBJECT_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLObjectType(config);
  } else if (isInterfaceType(type)) {
    const config = (type as GraphQLInterfaceType).toConfig();
    if (config.astNode != null) {
      const fields: Array<FieldDefinitionNode> = [];
      Object.values(config.fields).forEach(fieldConfig => {
        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      });
      config.astNode = {
        ...config.astNode,
        kind: Kind.INTERFACE_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map(node => ({
        ...node,
        kind: Kind.INTERFACE_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLInterfaceType(config);
  } else if (isInputObjectType(type)) {
    const config = (type as GraphQLInputObjectType).toConfig();
    if (config.astNode != null) {
      const fields: Array<InputValueDefinitionNode> = [];
      Object.values(config.fields).forEach(fieldConfig => {
        if (fieldConfig.astNode != null) {
          fields.push(fieldConfig.astNode);
        }
      });
      config.astNode = {
        ...config.astNode,
        kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
        fields,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map(node => ({
        ...node,
        kind: Kind.INPUT_OBJECT_TYPE_EXTENSION,
        fields: undefined,
      }));
    }

    return new GraphQLInputObjectType(config);
  } else if (isEnumType(type)) {
    const config = (type as GraphQLEnumType).toConfig();
    if (config.astNode != null) {
      const values: Array<EnumValueDefinitionNode> = [];
      Object.values(config.values).forEach(enumValueConfig => {
        if (enumValueConfig.astNode != null) {
          values.push(enumValueConfig.astNode);
        }
      });
      config.astNode = {
        ...config.astNode,
        values,
      };
    }

    if (config.extensionASTNodes != null) {
      config.extensionASTNodes = config.extensionASTNodes.map(node => ({
        ...node,
        values: undefined,
      }));
    }

    return new GraphQLEnumType(config);
  } else {
    return type;
  }
}
