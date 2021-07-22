import { IResolvers, Maybe } from '@graphql-tools/utils';
import {
  DirectiveDefinitionNode,
  DirectiveLocationEnum,
  DocumentNode,
  EnumTypeDefinitionNode,
  EnumTypeExtensionNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  getDirectiveValues,
  GraphQLArgumentConfig,
  GraphQLDeprecatedDirective,
  GraphQLDirective,
  GraphQLEnumType,
  GraphQLEnumValueConfigMap,
  GraphQLFieldConfig,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  GraphQLSchema,
  GraphQLSpecifiedByDirective,
  introspectionTypes,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isIntrospectionType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isTypeDefinitionNode,
  isTypeExtensionNode,
  isUnionType,
  Kind,
  specifiedDirectives,
  specifiedScalarTypes,
  valueFromAST,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ObjectTypeExtensionNode,
  ScalarTypeDefinitionNode,
  ScalarTypeExtensionNode,
  SchemaDefinitionNode,
  SchemaExtensionNode,
  TypeDefinitionNode,
  TypeNode,
  UnionTypeDefinitionNode,
  UnionTypeExtensionNode,
  GraphQLType,
  InputObjectTypeDefinitionNode,
  InputObjectTypeExtensionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  InterfaceTypeExtensionNode,
} from 'graphql';
import type { GraphQLSchemaNormalizedConfig } from 'graphql/type/schema';

export function buildASTSchemaWithResolvers(schemaAST: DocumentNode, resolvers: IResolvers): GraphQLSchema {
  const config = extendSchemaImpl(
    {
      description: undefined,
      types: [],
      directives: [],
      extensions: undefined,
      extensionASTNodes: [],
    },
    schemaAST,
    resolvers
  );

  if (config.astNode == null) {
    for (const type of config.types) {
      switch (type.name) {
        // Note: While this could make early assertions to get the correctly
        // typed values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable results.
        case 'Query':
          config.query = type as any;
          break;
        case 'Mutation':
          config.mutation = type as any;
          break;
        case 'Subscription':
          config.subscription = type as any;
          break;
      }
    }
  }

  const { directives } = config;
  // If specified directives were not explicitly declared, add them.
  for (const stdDirective of specifiedDirectives) {
    if (directives.every(directive => directive.name !== stdDirective.name)) {
      directives.push(stdDirective);
    }
  }

  return new GraphQLSchema(config);
}

const stdTypeMap = keyMap([...specifiedScalarTypes, ...introspectionTypes], type => type.name);

function keyMap<T>(list: readonly T[], keyFn: (item: T) => string): Record<string, T> {
  return list.reduce((map, item) => {
    map[keyFn(item)] = item;
    return map;
  }, Object.create(null));
}

function mapValue<T, V>(map: Record<string, T>, fn: (value: T, key: string) => V): Record<string, V> {
  const result = Object.create(null);

  for (const [key, value] of Object.entries(map)) {
    result[key] = fn(value, key);
  }
  return result;
}

/**
 * Given a scalar node, returns the string value for the specifiedByUrl.
 */
function getSpecifiedByUrl(node: ScalarTypeDefinitionNode | ScalarTypeExtensionNode): Maybe<string> {
  const specifiedBy = getDirectiveValues(GraphQLSpecifiedByDirective, node);
  return specifiedBy?.url;
}

/**
 * Given a field or enum value node, returns the string value for the
 * deprecation reason.
 */
function getDeprecationReason(
  node: EnumValueDefinitionNode | FieldDefinitionNode | InputValueDefinitionNode
): Maybe<string> {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated?.reason as any;
}

function extendSchemaImpl(
  schemaConfig: Omit<GraphQLSchemaNormalizedConfig, 'assumeValid'>,
  documentAST: DocumentNode,
  resolvers: IResolvers
): Omit<GraphQLSchemaNormalizedConfig, 'assumeValid'> {
  // Collect the type definitions and extensions found in the document.
  const typeDefs: Array<TypeDefinitionNode> = [];
  const typeExtensionsMap = Object.create(null);

  // New directives and types are separate because a directives and types can
  // have the same name. For example, a type named "skip".
  const directiveDefs: Array<DirectiveDefinitionNode> = [];

  let schemaDef: SchemaDefinitionNode;
  // Schema extensions are collected which may add additional operation types.
  const schemaExtensions: Array<SchemaExtensionNode> = [];

  for (const def of documentAST.definitions) {
    if (def.kind === Kind.SCHEMA_DEFINITION) {
      schemaDef = def;
    } else if (def.kind === Kind.SCHEMA_EXTENSION) {
      schemaExtensions.push(def);
    } else if (isTypeDefinitionNode(def)) {
      typeDefs.push(def);
    } else if (isTypeExtensionNode(def)) {
      const extendedTypeName = def.name.value;
      const existingTypeExtensions = typeExtensionsMap[extendedTypeName];
      typeExtensionsMap[extendedTypeName] = existingTypeExtensions ? existingTypeExtensions.concat([def]) : [def];
    } else if (def.kind === Kind.DIRECTIVE_DEFINITION) {
      directiveDefs.push(def);
    }
  }
  // If this document contains no new types, extensions, or directives then
  // return the same unmodified GraphQLSchema instance.
  if (
    Object.keys(typeExtensionsMap).length === 0 &&
    typeDefs.length === 0 &&
    directiveDefs.length === 0 &&
    schemaExtensions.length === 0 &&
    schemaDef == null
  ) {
    return schemaConfig;
  }

  const typeMap = Object.create(null);
  for (const existingType of schemaConfig.types) {
    typeMap[existingType.name] = extendNamedType(existingType);
  }

  for (const typeNode of typeDefs) {
    const name = typeNode.name.value;
    typeMap[name] = stdTypeMap[name] ?? buildType(typeNode, resolvers);
  }

  const operationTypes = {
    // Get the extended root operation types.
    query: schemaConfig.query && replaceNamedType(schemaConfig.query),
    mutation: schemaConfig.mutation && replaceNamedType(schemaConfig.mutation),
    subscription: schemaConfig.subscription && replaceNamedType(schemaConfig.subscription),
    // Then, incorporate schema definition and all schema extensions.
    ...(schemaDef && getOperationTypes([schemaDef])),
    ...getOperationTypes(schemaExtensions),
  };

  // Then produce and return a Schema config with these types.
  return {
    description: schemaDef?.description?.value,
    ...operationTypes,
    types: Object.values(typeMap),
    directives: [...schemaConfig.directives.map(replaceDirective), ...directiveDefs.map(buildDirective)],
    extensions: undefined,
    astNode: schemaDef ?? schemaConfig.astNode,
    extensionASTNodes: schemaConfig.extensionASTNodes.concat(schemaExtensions),
  };

  // Below are functions used for producing this schema that have closed over
  // this scope and have access to the schema, cache, and newly defined types.

  function replaceType<T extends GraphQLType>(type: T): T {
    if (isListType(type)) {
      return new GraphQLList(replaceType(type.ofType)) as T;
    }
    if (isNonNullType(type)) {
      return new GraphQLNonNull(replaceType(type.ofType)) as T;
    }
    return replaceNamedType(type as GraphQLNamedType) as T;
  }

  function replaceNamedType<T extends GraphQLNamedType>(type: T): T {
    return typeMap[type.name];
  }

  function replaceDirective(directive: GraphQLDirective): GraphQLDirective {
    const config = directive.toConfig();
    return new GraphQLDirective({
      ...config,
      args: mapValue(config.args, extendArg),
    });
  }

  function extendNamedType(type: GraphQLNamedType): GraphQLNamedType {
    if (isIntrospectionType(type) || isSpecifiedScalarType(type)) {
      // Builtin types are not extended.
      return type;
    }
    if (isScalarType(type)) {
      return extendScalarType(type);
    }
    if (isObjectType(type)) {
      return extendObjectType(type);
    }
    if (isInterfaceType(type)) {
      return extendInterfaceType(type);
    }
    if (isUnionType(type)) {
      return extendUnionType(type);
    }
    if (isEnumType(type)) {
      return extendEnumType(type);
    }
    if (isInputObjectType(type)) {
      return extendInputObjectType(type);
    }
  }

  function extendInputObjectType(type: GraphQLInputObjectType): GraphQLInputObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

    return new GraphQLInputObjectType({
      ...config,
      fields: () => ({
        ...mapValue(config.fields, field => ({
          ...field,
          type: replaceType(field.type),
        })),
        ...buildInputFieldMap(extensions),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendEnumType(type: GraphQLEnumType): GraphQLEnumType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[type.name] ?? [];

    return new GraphQLEnumType({
      ...config,
      values: {
        ...config.values,
        ...buildEnumValueMap(extensions),
      },
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendScalarType(type: GraphQLScalarType): GraphQLScalarType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

    let specifiedByUrl = config.specifiedByUrl;
    for (const extensionNode of extensions) {
      specifiedByUrl = getSpecifiedByUrl(extensionNode) ?? specifiedByUrl;
    }

    return new GraphQLScalarType({
      ...config,
      specifiedByUrl,
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendObjectType(type: GraphQLObjectType): GraphQLObjectType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

    return new GraphQLObjectType({
      ...config,
      interfaces: () => [...type.getInterfaces().map(replaceNamedType), ...buildInterfaces(extensions)],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions, resolvers),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendInterfaceType(type: GraphQLInterfaceType): GraphQLInterfaceType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

    return new GraphQLInterfaceType({
      ...config,
      interfaces: () => [...type.getInterfaces().map(replaceNamedType), ...buildInterfaces(extensions)],
      fields: () => ({
        ...mapValue(config.fields, extendField),
        ...buildFieldMap(extensions, resolvers),
      }),
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendUnionType(type: GraphQLUnionType): GraphQLUnionType {
    const config = type.toConfig();
    const extensions = typeExtensionsMap[config.name] ?? [];

    return new GraphQLUnionType({
      ...config,
      types: () => [...type.getTypes().map(replaceNamedType), ...buildUnionTypes(extensions)],
      extensionASTNodes: config.extensionASTNodes.concat(extensions),
    });
  }

  function extendField(field: GraphQLFieldConfig<any, any>): GraphQLFieldConfig<any, any> {
    return {
      ...field,
      type: replaceType(field.type),
      // $FlowFixMe[incompatible-call]
      args: mapValue(field.args, extendArg),
    };
  }

  function extendArg(arg: GraphQLArgumentConfig) {
    return {
      ...arg,
      type: replaceType(arg.type),
    };
  }

  function getOperationTypes(
    nodes: readonly (SchemaDefinitionNode | SchemaExtensionNode)[]
  ): {
    query?: GraphQLObjectType;
    mutation?: GraphQLObjectType;
    subscription?: GraphQLObjectType;
  } {
    const opTypes = {};
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const operationTypesNodes = node.operationTypes ?? [];

      for (const operationType of operationTypesNodes) {
        opTypes[operationType.operation] = getNamedType(operationType.type);
      }
    }

    // Note: While this could make early assertions to get the correctly
    // typed values below, that would throw immediately while type system
    // validation with validateSchema() will produce more actionable results.
    return opTypes;
  }

  function getNamedType(node: NamedTypeNode): GraphQLNamedType {
    const name = node.name.value;
    const type = stdTypeMap[name] ?? typeMap[name];

    if (type === undefined) {
      throw new Error(`Unknown type: "${name}".`);
    }
    return type;
  }

  function getWrappedType(node: TypeNode): GraphQLType {
    if (node.kind === Kind.LIST_TYPE) {
      return new GraphQLList(getWrappedType(node.type));
    }
    if (node.kind === Kind.NON_NULL_TYPE) {
      return new GraphQLNonNull(getWrappedType(node.type));
    }
    return getNamedType(node);
  }

  function buildDirective(node: DirectiveDefinitionNode): GraphQLDirective {
    const locations = node.locations.map(({ value }) => (value as any) as DirectiveLocationEnum);

    return new GraphQLDirective({
      name: node.name.value,
      description: node.description.value,
      locations,
      isRepeatable: node.repeatable,
      args: buildArgumentMap(node.arguments),
      astNode: node,
    });
  }

  function buildFieldMap(
    nodes: ReadonlyArray<
      InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode | ObjectTypeDefinitionNode | ObjectTypeExtensionNode
    >,
    resolvers: IResolvers
  ): GraphQLFieldConfigMap<any, any> {
    const fieldConfigMap: GraphQLFieldConfigMap<any, any> = Object.create(null);
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const nodeFields = node.fields ?? [];

      for (const field of nodeFields) {
        fieldConfigMap[field.name.value] = {
          // Note: While this could make assertions to get the correctly typed
          // value, that would throw immediately while type system validation
          // with validateSchema() will produce more actionable results.
          type: getWrappedType(field.type) as any,
          description: field.description?.value,
          args: buildArgumentMap(field.arguments),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
          resolve: resolvers[node.name.value]?.[field.name.value],
        };
      }
    }
    return fieldConfigMap;
  }

  function buildArgumentMap(args?: Maybe<ReadonlyArray<InputValueDefinitionNode>>): GraphQLFieldConfigArgumentMap {
    const argsNodes = args ?? [];

    const argConfigMap = Object.create(null);
    for (const arg of argsNodes) {
      // Note: While this could make assertions to get the correctly typed
      // value, that would throw immediately while type system validation
      // with validateSchema() will produce more actionable results.
      const type: any = getWrappedType(arg.type);

      argConfigMap[arg.name.value] = {
        type,
        description: arg.description?.value,
        defaultValue: valueFromAST(arg.defaultValue, type),
        deprecationReason: getDeprecationReason(arg),
        astNode: arg,
      };
    }
    return argConfigMap;
  }

  function buildInputFieldMap(
    nodes: ReadonlyArray<InputObjectTypeDefinitionNode | InputObjectTypeExtensionNode>
  ): GraphQLInputFieldConfigMap {
    const inputFieldMap = Object.create(null);
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const fieldsNodes = node.fields ?? [];

      for (const field of fieldsNodes) {
        // Note: While this could make assertions to get the correctly typed
        // value, that would throw immediately while type system validation
        // with validateSchema() will produce more actionable results.
        const type: any = getWrappedType(field.type);

        inputFieldMap[field.name.value] = {
          type,
          description: field.description?.value,
          defaultValue: valueFromAST(field.defaultValue, type),
          deprecationReason: getDeprecationReason(field),
          astNode: field,
        };
      }
    }
    return inputFieldMap;
  }

  function buildEnumValueMap(
    nodes: ReadonlyArray<EnumTypeDefinitionNode | EnumTypeExtensionNode>
  ): GraphQLEnumValueConfigMap {
    const enumValueMap = Object.create(null);
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const valuesNodes = node.values ?? [];

      for (const value of valuesNodes) {
        enumValueMap[value.name.value] = {
          description: value.description?.value,
          deprecationReason: getDeprecationReason(value),
          astNode: value,
        };
      }
    }
    return enumValueMap;
  }

  function buildInterfaces(
    nodes: ReadonlyArray<
      InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode | ObjectTypeDefinitionNode | ObjectTypeExtensionNode
    >
  ): Array<GraphQLInterfaceType> {
    const interfaces: GraphQLInterfaceType[] = [];
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const interfacesNodes = node.interfaces ?? [];

      for (const type of interfacesNodes) {
        // Note: While this could make assertions to get the correctly typed
        // values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable
        // results.
        interfaces.push(getNamedType(type) as any);
      }
    }
    return interfaces;
  }

  function buildUnionTypes(
    nodes: ReadonlyArray<UnionTypeDefinitionNode | UnionTypeExtensionNode>
  ): Array<GraphQLObjectType> {
    const types = [];
    for (const node of nodes) {
      // istanbul ignore next (See: 'https://github.com/graphql/graphql-js/issues/2203')
      const typeNodes = node.types ?? [];

      for (const type of typeNodes) {
        // Note: While this could make assertions to get the correctly typed
        // values below, that would throw immediately while type system
        // validation with validateSchema() will produce more actionable
        // results.
        types.push(getNamedType(type) as any);
      }
    }
    return types;
  }

  function buildType(astNode: TypeDefinitionNode, resolvers: IResolvers): GraphQLNamedType {
    const name = astNode.name.value;
    const description = astNode.description?.value;
    const extensionNodes = typeExtensionsMap[name] ?? [];

    switch (astNode.kind) {
      case Kind.OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLObjectType({
          name,
          description,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes, resolvers),
          isTypeOf: resolvers[name]?.['__isTypeOf'],
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.INTERFACE_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLInterfaceType({
          name,
          description,
          interfaces: () => buildInterfaces(allNodes),
          fields: () => buildFieldMap(allNodes, resolvers),
          resolveType: resolvers[name]?.['__resolveType'],
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.ENUM_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLEnumType({
          name,
          description,
          values: buildEnumValueMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.UNION_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLUnionType({
          name,
          description,
          types: () => buildUnionTypes(allNodes),
          resolveType: resolvers[name]?.['__resolveType'],
          astNode,
          extensionASTNodes,
        });
      }
      case Kind.SCALAR_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;

        return new GraphQLScalarType({
          name,
          description,
          specifiedByUrl: getSpecifiedByUrl(astNode),
          astNode,
          extensionASTNodes,
          ...(resolvers[name] ?? {}),
        });
      }
      case Kind.INPUT_OBJECT_TYPE_DEFINITION: {
        const extensionASTNodes = extensionNodes as any;
        const allNodes = [astNode, ...extensionASTNodes];

        return new GraphQLInputObjectType({
          name,
          description,
          fields: () => buildInputFieldMap(allNodes),
          astNode,
          extensionASTNodes,
        });
      }
    }
  }
}
