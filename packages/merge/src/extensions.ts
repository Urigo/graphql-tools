import {
  GraphQLSchema,
  isObjectType,
  isInterfaceType,
  isInputObjectType,
  GraphQLField,
  GraphQLInputField,
  isUnionType,
  isScalarType,
  isEnumType,
  isSpecifiedScalarType,
  isIntrospectionType,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLInterfaceType,
} from 'graphql';
import { Maybe, mergeDeep } from '@graphql-tools/utils';

export type ExtensionsObject = Record<string, any>;

export type ObjectTypeExtensions = {
  type: 'object';
  fields: Record<string, { extensions: ExtensionsObject; arguments: Record<string, ExtensionsObject> }>;
};

export type InputTypeExtensions = {
  type: 'input';
  fields: Record<string, { extensions: ExtensionsObject }>;
};

export type InterfaceTypeExtensions = {
  type: 'interface';
  fields: Record<string, { extensions: ExtensionsObject; arguments: Record<string, ExtensionsObject> }>;
};

export type UnionTypeExtensions = {
  type: 'union';
};

export type ScalarTypeExtensions = {
  type: 'scalar';
};

export type EnumTypeExtensions = {
  type: 'enum';
  values: Record<string, ExtensionsObject>;
};

export type PossibleTypeExtensions =
  | InputTypeExtensions
  | InterfaceTypeExtensions
  | ObjectTypeExtensions
  | UnionTypeExtensions
  | ScalarTypeExtensions
  | EnumTypeExtensions;
export type SchemaExtensions = {
  schemaExtensions: ExtensionsObject;
  types: Record<string, { extensions: ExtensionsObject } & PossibleTypeExtensions>;
};

export function travelSchemaPossibleExtensions(
  schema: GraphQLSchema,
  hooks: {
    onSchema: (schema: GraphQLSchema) => any;
    onObjectType: (type: GraphQLObjectType) => any;
    onObjectField: (type: GraphQLObjectType, field: GraphQLField<any, any>) => any;
    onObjectFieldArg: (type: GraphQLObjectType, field: GraphQLField<any, any>, arg: GraphQLArgument) => any;
    onInterface: (type: GraphQLInterfaceType) => any;
    onInterfaceField: (type: GraphQLInterfaceType, field: GraphQLField<any, any>) => any;
    onInterfaceFieldArg: (type: GraphQLInterfaceType, field: GraphQLField<any, any>, arg: GraphQLArgument) => any;
    onInputType: (type: GraphQLInputObjectType) => any;
    onInputFieldType: (type: GraphQLInputObjectType, field: GraphQLInputField) => any;
    onUnion: (type: GraphQLUnionType) => any;
    onScalar: (type: GraphQLScalarType) => any;
    onEnum: (type: GraphQLEnumType) => any;
    onEnumValue: (type: GraphQLEnumType, value: GraphQLEnumValue) => any;
  }
) {
  hooks.onSchema(schema);
  const typesMap = schema.getTypeMap();

  for (const [, type] of Object.entries(typesMap)) {
    const isPredefinedScalar = isScalarType(type) && isSpecifiedScalarType(type);
    const isIntrospection = isIntrospectionType(type);

    if (isPredefinedScalar || isIntrospection) {
      continue;
    }

    if (isObjectType(type)) {
      hooks.onObjectType(type);

      const fields = type.getFields();
      for (const [, field] of Object.entries(fields)) {
        hooks.onObjectField(type, field);

        const args = field.args || [];

        for (const arg of args) {
          hooks.onObjectFieldArg(type, field, arg);
        }
      }
    } else if (isInterfaceType(type)) {
      hooks.onInterface(type);

      const fields = type.getFields();
      for (const [, field] of Object.entries(fields)) {
        hooks.onInterfaceField(type, field);

        const args = field.args || [];

        for (const arg of args) {
          hooks.onInterfaceFieldArg(type, field, arg);
        }
      }
    } else if (isInputObjectType(type)) {
      hooks.onInputType(type);

      const fields = type.getFields();
      for (const [, field] of Object.entries(fields)) {
        hooks.onInputFieldType(type, field);
      }
    } else if (isUnionType(type)) {
      hooks.onUnion(type);
    } else if (isScalarType(type)) {
      hooks.onScalar(type);
    } else if (isEnumType(type)) {
      hooks.onEnum(type);

      for (const value of type.getValues()) {
        hooks.onEnumValue(type, value);
      }
    }
  }
}

export function mergeExtensions(extensions: SchemaExtensions[]): SchemaExtensions {
  return extensions.reduce(
    (result, extensionObj) => [result, extensionObj].reduce<SchemaExtensions>(mergeDeep, {} as SchemaExtensions),
    {} as SchemaExtensions
  );
}

function applyExtensionObject(
  obj: Maybe<{ extensions: Maybe<Readonly<Record<string, any>>> }>,
  extensions: ExtensionsObject
) {
  if (!obj) {
    return;
  }

  obj.extensions = [obj.extensions || {}, extensions || {}].reduce(mergeDeep, {});
}

export function applyExtensions(schema: GraphQLSchema, extensions: SchemaExtensions): GraphQLSchema {
  applyExtensionObject(schema, extensions.schemaExtensions);

  for (const [typeName, data] of Object.entries(extensions.types || {})) {
    const type = schema.getType(typeName);

    if (type) {
      applyExtensionObject(type, data.extensions);

      if (data.type === 'object' || data.type === 'interface') {
        for (const [fieldName, fieldData] of Object.entries(data.fields)) {
          const field = (type as GraphQLObjectType).getFields()[fieldName];

          if (field) {
            applyExtensionObject(field, fieldData.extensions);

            for (const [arg, argData] of Object.entries(fieldData.arguments)) {
              applyExtensionObject(
                field.args.find(a => a.name === arg),
                argData
              );
            }
          }
        }
      } else if (data.type === 'input') {
        for (const [fieldName, fieldData] of Object.entries(data.fields)) {
          const field = (type as GraphQLObjectType).getFields()[fieldName];
          applyExtensionObject(field, fieldData.extensions);
        }
      } else if (data.type === 'enum') {
        for (const [valueName, valueData] of Object.entries(data.values)) {
          const value = (type as GraphQLEnumType).getValue(valueName);
          applyExtensionObject(value, valueData);
        }
      }
    }
  }

  return schema;
}

export function extractExtensionsFromSchema(schema: GraphQLSchema): SchemaExtensions {
  const result: SchemaExtensions = {
    schemaExtensions: {},
    types: {},
  };

  travelSchemaPossibleExtensions(schema, {
    onSchema: schema => (result.schemaExtensions = schema.extensions || {}),
    onObjectType: type => (result.types[type.name] = { fields: {}, type: 'object', extensions: type.extensions || {} }),
    onObjectField: (type, field) =>
      ((result.types[type.name] as ObjectTypeExtensions).fields[field.name] = {
        arguments: {},
        extensions: field.extensions || {},
      }),
    onObjectFieldArg: (type, field, arg) =>
      ((result.types[type.name] as ObjectTypeExtensions).fields[field.name].arguments[arg.name] = arg.extensions || {}),
    onInterface: type =>
      (result.types[type.name] = { fields: {}, type: 'interface', extensions: type.extensions || {} }),
    onInterfaceField: (type, field) =>
      ((result.types[type.name] as InterfaceTypeExtensions).fields[field.name] = {
        arguments: {},
        extensions: field.extensions || {},
      }),
    onInterfaceFieldArg: (type, field, arg) =>
      ((result.types[type.name] as InterfaceTypeExtensions).fields[field.name].arguments[arg.name] =
        arg.extensions || {}),
    onEnum: type => (result.types[type.name] = { values: {}, type: 'enum', extensions: type.extensions || {} }),
    onEnumValue: (type, value) =>
      ((result.types[type.name] as EnumTypeExtensions).values[value.name] = value.extensions || {}),
    onScalar: type => (result.types[type.name] = { type: 'scalar', extensions: type.extensions || {} }),
    onUnion: type => (result.types[type.name] = { type: 'union', extensions: type.extensions || {} }),
    onInputType: type => (result.types[type.name] = { fields: {}, type: 'input', extensions: type.extensions || {} }),
    onInputFieldType: (type, field) =>
      ((result.types[type.name] as InputTypeExtensions).fields[field.name] = { extensions: field.extensions || {} }),
  });

  return result;
}
