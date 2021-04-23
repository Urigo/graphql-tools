import {
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLObjectType,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLType,
  GraphQLUnionType,
  isInterfaceType,
  isEnumType,
  isInputObjectType,
  isListType,
  isNamedType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  isSpecifiedScalarType,
  isSpecifiedDirective,
} from 'graphql';

import { getBuiltInForStub, isNamedStub } from './stub';
import { TypeMap } from './Interfaces';

export function rewireTypes(
  originalTypeMap: Record<string, GraphQLNamedType | null>,
  directives: ReadonlyArray<GraphQLDirective>
): {
  typeMap: TypeMap;
  directives: Array<GraphQLDirective>;
} {
  const referenceTypeMap = Object.create(null);
  Object.keys(originalTypeMap).forEach(typeName => {
    referenceTypeMap[typeName] = originalTypeMap[typeName];
  });
  const newTypeMap: TypeMap = Object.create(null);

  Object.keys(referenceTypeMap).forEach(typeName => {
    const namedType = referenceTypeMap[typeName];

    if (namedType == null || typeName.startsWith('__')) {
      return;
    }

    const newName = namedType.name;
    if (newName.startsWith('__')) {
      return;
    }

    if (newTypeMap[newName] != null) {
      throw new Error(`Duplicate schema type name ${newName}`);
    }

    newTypeMap[newName] = namedType;
  });

  Object.keys(newTypeMap).forEach(typeName => {
    newTypeMap[typeName] = rewireNamedType(newTypeMap[typeName]);
  });

  const newDirectives = directives.map(directive => rewireDirective(directive));

  return {
    typeMap: newTypeMap,
    directives: newDirectives,
  };

  function rewireDirective(directive: GraphQLDirective): GraphQLDirective {
    if (isSpecifiedDirective(directive)) {
      return directive;
    }
    const directiveConfig = directive.toConfig();
    directiveConfig.args = rewireArgs(directiveConfig.args);
    return new GraphQLDirective(directiveConfig);
  }

  function rewireArgs(args: GraphQLFieldConfigArgumentMap): GraphQLFieldConfigArgumentMap {
    const rewiredArgs = {};
    Object.keys(args).forEach(argName => {
      const arg = args[argName];
      const rewiredArgType = rewireType(arg.type);
      if (rewiredArgType != null) {
        arg.type = rewiredArgType;
        rewiredArgs[argName] = arg;
      }
    });
    return rewiredArgs;
  }

  function rewireNamedType<T extends GraphQLNamedType>(type: T) {
    if (isObjectType(type)) {
      const config = (type as GraphQLObjectType).toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireFields(config.fields),
        interfaces: () => rewireNamedTypes(config.interfaces),
      };
      return new GraphQLObjectType(newConfig);
    } else if (isInterfaceType(type)) {
      const config = (type as GraphQLInterfaceType).toConfig();
      const newConfig: any = {
        ...config,
        fields: () => rewireFields(config.fields),
      };
      if ('interfaces' in newConfig) {
        newConfig.interfaces = () =>
          rewireNamedTypes(((config as unknown) as { interfaces: Array<GraphQLInterfaceType> }).interfaces);
      }
      return new GraphQLInterfaceType(newConfig);
    } else if (isUnionType(type)) {
      const config = (type as GraphQLUnionType).toConfig();
      const newConfig = {
        ...config,
        types: () => rewireNamedTypes(config.types),
      };
      return new GraphQLUnionType(newConfig);
    } else if (isInputObjectType(type)) {
      const config = (type as GraphQLInputObjectType).toConfig();
      const newConfig = {
        ...config,
        fields: () => rewireInputFields(config.fields),
      };
      return new GraphQLInputObjectType(newConfig);
    } else if (isEnumType(type)) {
      const enumConfig = (type as GraphQLEnumType).toConfig();
      return new GraphQLEnumType(enumConfig);
    } else if (isScalarType(type)) {
      if (isSpecifiedScalarType(type)) {
        return type;
      }
      const scalarConfig = (type as GraphQLScalarType).toConfig();
      return new GraphQLScalarType(scalarConfig);
    }

    throw new Error(`Unexpected schema type: ${(type as unknown) as string}`);
  }

  function rewireFields(fields: GraphQLFieldConfigMap<any, any>): GraphQLFieldConfigMap<any, any> {
    const rewiredFields = {};
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null) {
        field.type = rewiredFieldType;
        field.args = rewireArgs(field.args);
        rewiredFields[fieldName] = field;
      }
    });
    return rewiredFields;
  }

  function rewireInputFields(fields: GraphQLInputFieldConfigMap): GraphQLInputFieldConfigMap {
    const rewiredFields = {};
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      const rewiredFieldType = rewireType(field.type);
      if (rewiredFieldType != null) {
        field.type = rewiredFieldType;
        rewiredFields[fieldName] = field;
      }
    });
    return rewiredFields;
  }

  function rewireNamedTypes<T extends GraphQLNamedType>(namedTypes: Array<T>): Array<T> {
    const rewiredTypes: Array<T> = [];
    namedTypes.forEach(namedType => {
      const rewiredType = rewireType(namedType);
      if (rewiredType != null) {
        rewiredTypes.push(rewiredType);
      }
    });
    return rewiredTypes;
  }

  function rewireType<T extends GraphQLType>(type: T): T | null {
    if (isListType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null ? (new GraphQLList(rewiredType) as T) : null;
    } else if (isNonNullType(type)) {
      const rewiredType = rewireType(type.ofType);
      return rewiredType != null ? (new GraphQLNonNull(rewiredType) as T) : null;
    } else if (isNamedType(type)) {
      let rewiredType = referenceTypeMap[type.name];
      if (rewiredType === undefined) {
        rewiredType = isNamedStub(type) ? getBuiltInForStub(type) : rewireNamedType(type);
        newTypeMap[rewiredType.name] = referenceTypeMap[type.name] = rewiredType;
      }
      return rewiredType != null ? (newTypeMap[rewiredType.name] as T) : null;
    }

    return null;
  }
}
