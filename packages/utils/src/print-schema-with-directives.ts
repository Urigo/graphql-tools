import {
  GraphQLSchema,
  print,
  GraphQLNamedType,
  Kind,
  isSpecifiedScalarType,
  isIntrospectionType,
  TypeDefinitionNode,
  DirectiveNode,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  GraphQLArgument,
  EnumValueDefinitionNode,
  isSpecifiedDirective,
  GraphQLDirective,
  DirectiveDefinitionNode,
  astFromValue,
  ArgumentNode,
  SchemaDefinitionNode,
  OperationTypeDefinitionNode,
  SchemaExtensionNode,
  OperationTypeNode,
  GraphQLObjectType,
  GraphQLDeprecatedDirective,
  isObjectType,
  ObjectTypeDefinitionNode,
  GraphQLField,
  NamedTypeNode,
  TypeExtensionNode,
  GraphQLInterfaceType,
  InterfaceTypeDefinitionNode,
  isInterfaceType,
  isUnionType,
  UnionTypeDefinitionNode,
  GraphQLUnionType,
  isInputObjectType,
  GraphQLInputObjectType,
  InputObjectTypeDefinitionNode,
  GraphQLInputField,
  isEnumType,
  isScalarType,
  GraphQLEnumType,
  GraphQLEnumValue,
  EnumTypeDefinitionNode,
  GraphQLScalarType,
  ScalarTypeDefinitionNode,
  DefinitionNode,
  DocumentNode,
  StringValueNode,
} from 'graphql';
import { GetDocumentNodeFromSchemaOptions, PrintSchemaWithDirectivesOptions, Maybe } from './types';

import { astFromType } from './astFromType';
import { getDirectivesInExtensions } from './get-directives';
import { astFromValueUntyped } from './astFromValueUntyped';
import { isSome } from './helpers';

export function getDocumentNodeFromSchema(
  schema: GraphQLSchema,
  options: GetDocumentNodeFromSchemaOptions = {}
): DocumentNode {
  const pathToDirectivesInExtensions = options.pathToDirectivesInExtensions;

  const typesMap = schema.getTypeMap();

  const schemaNode = astFromSchema(schema, pathToDirectivesInExtensions);
  const definitions: Array<DefinitionNode> = schemaNode != null ? [schemaNode] : [];

  const directives = schema.getDirectives();
  for (const directive of directives) {
    if (isSpecifiedDirective(directive)) {
      continue;
    }

    definitions.push(astFromDirective(directive, schema, pathToDirectivesInExtensions));
  }

  for (const typeName in typesMap) {
    const type = typesMap[typeName];
    const isPredefinedScalar = isSpecifiedScalarType(type);
    const isIntrospection = isIntrospectionType(type);

    if (isPredefinedScalar || isIntrospection) {
      continue;
    }

    if (isObjectType(type)) {
      definitions.push(astFromObjectType(type, schema, pathToDirectivesInExtensions));
    } else if (isInterfaceType(type)) {
      definitions.push(astFromInterfaceType(type, schema, pathToDirectivesInExtensions));
    } else if (isUnionType(type)) {
      definitions.push(astFromUnionType(type, schema, pathToDirectivesInExtensions));
    } else if (isInputObjectType(type)) {
      definitions.push(astFromInputObjectType(type, schema, pathToDirectivesInExtensions));
    } else if (isEnumType(type)) {
      definitions.push(astFromEnumType(type, schema, pathToDirectivesInExtensions));
    } else if (isScalarType(type)) {
      definitions.push(astFromScalarType(type, schema, pathToDirectivesInExtensions));
    } else {
      throw new Error(`Unknown type ${type}.`);
    }
  }

  return {
    kind: Kind.DOCUMENT,
    definitions,
  };
}

// this approach uses the default schema printer rather than a custom solution, so may be more backwards compatible
// currently does not allow customization of printSchema options having to do with comments.
export function printSchemaWithDirectives(
  schema: GraphQLSchema,
  options: PrintSchemaWithDirectivesOptions = {}
): string {
  const documentNode = getDocumentNodeFromSchema(schema, options);
  return print(documentNode);
}

export function astFromSchema(
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): SchemaDefinitionNode | SchemaExtensionNode | null {
  const operationTypeMap: Record<OperationTypeNode, Maybe<OperationTypeDefinitionNode>> = {
    query: undefined,
    mutation: undefined,
    subscription: undefined,
  };

  let nodes: Array<SchemaDefinitionNode | SchemaExtensionNode> = [];
  if (schema.astNode != null) {
    nodes.push(schema.astNode);
  }
  if (schema.extensionASTNodes != null) {
    nodes = nodes.concat(schema.extensionASTNodes);
  }

  nodes.forEach(node => {
    if (node.operationTypes) {
      node.operationTypes.forEach(operationTypeDefinitionNode => {
        operationTypeMap[operationTypeDefinitionNode.operation] = operationTypeDefinitionNode;
      });
    }
  });

  const rootTypeMap: Record<OperationTypeNode, Maybe<GraphQLObjectType>> = {
    query: schema.getQueryType(),
    mutation: schema.getMutationType(),
    subscription: schema.getSubscriptionType(),
  };

  Object.keys(operationTypeMap).forEach(operationTypeNode => {
    if (rootTypeMap[operationTypeNode] != null) {
      if (operationTypeMap[operationTypeNode] != null) {
        operationTypeMap[operationTypeNode].type = astFromType(rootTypeMap[operationTypeNode]);
      } else {
        operationTypeMap[operationTypeNode] = {
          kind: Kind.OPERATION_TYPE_DEFINITION,
          operation: operationTypeNode,
          type: astFromType(rootTypeMap[operationTypeNode]),
        };
      }
    }
  });

  const operationTypes = Object.values(operationTypeMap).filter(isSome);

  const directives = getDirectiveNodes(schema, schema, pathToDirectivesInExtensions);

  if (!operationTypes.length && !directives.length) {
    return null;
  }

  const schemaNode: SchemaDefinitionNode | SchemaExtensionNode = {
    kind: operationTypes != null ? Kind.SCHEMA_DEFINITION : Kind.SCHEMA_EXTENSION,
    operationTypes,
    directives,
  };

  // This code is so weird because it needs to support GraphQL.js 14
  // In GraphQL.js 14 there is no `description` value on schemaNode
  (schemaNode as unknown as { description?: StringValueNode }).description =
    (schema.astNode as unknown as { description: string })?.description ??
    (schema as unknown as { description: string }).description != null
      ? {
          kind: Kind.STRING,
          value: (schema as unknown as { description: string }).description,
          block: true,
        }
      : undefined;

  return schemaNode;
}

export function astFromDirective(
  directive: GraphQLDirective,
  schema?: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): DirectiveDefinitionNode {
  return {
    kind: Kind.DIRECTIVE_DEFINITION,
    description:
      directive.astNode?.description ??
      (directive.description
        ? {
            kind: Kind.STRING,
            value: directive.description,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: directive.name,
    },
    arguments: directive?.args
      ? directive.args.map(arg => astFromArg(arg, schema, pathToDirectivesInExtensions))
      : undefined,
    repeatable: directive.isRepeatable,
    locations: directive?.locations
      ? directive.locations.map(location => ({
          kind: Kind.NAME,
          value: location,
        }))
      : [],
  };
}

export function getDirectiveNodes(
  entity: GraphQLSchema | GraphQLNamedType | GraphQLEnumValue,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): Array<DirectiveNode> {
  const directivesInExtensions = getDirectivesInExtensions(entity, pathToDirectivesInExtensions);

  let nodes: Array<
    SchemaDefinitionNode | SchemaExtensionNode | TypeDefinitionNode | TypeExtensionNode | EnumValueDefinitionNode
  > = [];
  if (entity.astNode != null) {
    nodes.push(entity.astNode);
  }
  if ('extensionASTNodes' in entity && entity.extensionASTNodes != null) {
    nodes = nodes.concat(entity.extensionASTNodes);
  }

  let directives: Array<DirectiveNode>;
  if (directivesInExtensions != null) {
    directives = makeDirectiveNodes(schema, directivesInExtensions);
  } else {
    directives = [];
    for (const node of nodes) {
      if (node.directives) {
        directives.push(...node.directives);
      }
    }
  }

  return directives;
}

export function getDeprecatableDirectiveNodes(
  entity: GraphQLArgument | GraphQLField<any, any> | GraphQLInputField,
  schema?: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): Array<DirectiveNode> {
  let directiveNodesBesidesDeprecated: Array<DirectiveNode> = [];
  let deprecatedDirectiveNode: Maybe<DirectiveNode> = null;

  const directivesInExtensions = getDirectivesInExtensions(entity, pathToDirectivesInExtensions);

  let directives: Maybe<ReadonlyArray<DirectiveNode>>;
  if (directivesInExtensions != null) {
    directives = makeDirectiveNodes(schema, directivesInExtensions);
  } else {
    directives = entity.astNode?.directives;
  }

  if (directives != null) {
    directiveNodesBesidesDeprecated = directives.filter(directive => directive.name.value !== 'deprecated');
    if ((entity as unknown as { deprecationReason: string }).deprecationReason != null) {
      deprecatedDirectiveNode = directives.filter(directive => directive.name.value === 'deprecated')?.[0];
    }
  }

  if (
    (entity as unknown as { deprecationReason: string }).deprecationReason != null &&
    deprecatedDirectiveNode == null
  ) {
    deprecatedDirectiveNode = makeDeprecatedDirective(
      (entity as unknown as { deprecationReason: string }).deprecationReason
    );
  }

  return deprecatedDirectiveNode == null
    ? directiveNodesBesidesDeprecated
    : [deprecatedDirectiveNode].concat(directiveNodesBesidesDeprecated);
}

export function astFromArg(
  arg: GraphQLArgument,
  schema?: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): InputValueDefinitionNode {
  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    description:
      arg.astNode?.description ??
      (arg.description
        ? {
            kind: Kind.STRING,
            value: arg.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: arg.name,
    },
    type: astFromType(arg.type),
    defaultValue: arg.defaultValue !== undefined ? astFromValue(arg.defaultValue, arg.type) ?? undefined : undefined,
    directives: getDeprecatableDirectiveNodes(arg, schema, pathToDirectivesInExtensions),
  };
}

export function astFromObjectType(
  type: GraphQLObjectType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): ObjectTypeDefinitionNode {
  return {
    kind: Kind.OBJECT_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    fields: Object.values(type.getFields()).map(field => astFromField(field, schema, pathToDirectivesInExtensions)),
    interfaces: Object.values(type.getInterfaces()).map(iFace => astFromType(iFace) as NamedTypeNode),
    directives: getDirectiveNodes(type, schema, pathToDirectivesInExtensions),
  };
}

export function astFromInterfaceType(
  type: GraphQLInterfaceType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): InterfaceTypeDefinitionNode {
  const node: InterfaceTypeDefinitionNode = {
    kind: Kind.INTERFACE_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    fields: Object.values(type.getFields()).map(field => astFromField(field, schema, pathToDirectivesInExtensions)),
    directives: getDirectiveNodes(type, schema, pathToDirectivesInExtensions),
  };

  if ('getInterfaces' in type) {
    (node as unknown as { interfaces: Array<NamedTypeNode> }).interfaces = Object.values(
      (type as unknown as GraphQLObjectType).getInterfaces()
    ).map(iFace => astFromType(iFace) as NamedTypeNode);
  }

  return node;
}

export function astFromUnionType(
  type: GraphQLUnionType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): UnionTypeDefinitionNode {
  return {
    kind: Kind.UNION_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    directives: getDirectiveNodes(type, schema, pathToDirectivesInExtensions),
    types: type.getTypes().map(type => astFromType(type) as NamedTypeNode),
  };
}

export function astFromInputObjectType(
  type: GraphQLInputObjectType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): InputObjectTypeDefinitionNode {
  return {
    kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    fields: Object.values(type.getFields()).map(field =>
      astFromInputField(field, schema, pathToDirectivesInExtensions)
    ),
    directives: getDirectiveNodes(type, schema, pathToDirectivesInExtensions),
  };
}

export function astFromEnumType(
  type: GraphQLEnumType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): EnumTypeDefinitionNode {
  return {
    kind: Kind.ENUM_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    values: Object.values(type.getValues()).map(value => astFromEnumValue(value, schema, pathToDirectivesInExtensions)),
    directives: getDirectiveNodes(type, schema, pathToDirectivesInExtensions),
  };
}

export function astFromScalarType(
  type: GraphQLScalarType,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): ScalarTypeDefinitionNode {
  let directiveNodesBesidesSpecifiedBy: Array<DirectiveNode> = [];
  let specifiedByDirectiveNode: Maybe<DirectiveNode> = null;

  const directivesInExtensions = getDirectivesInExtensions(type, pathToDirectivesInExtensions);

  let allDirectives: Maybe<ReadonlyArray<DirectiveNode>>;
  if (directivesInExtensions != null) {
    allDirectives = makeDirectiveNodes(schema, directivesInExtensions);
  } else {
    allDirectives = type.astNode?.directives;
  }

  if (allDirectives != null) {
    directiveNodesBesidesSpecifiedBy = allDirectives.filter(directive => directive.name.value !== 'specifiedBy');
    if ((type as unknown as { specifiedByUrl: string }).specifiedByUrl != null) {
      specifiedByDirectiveNode = allDirectives.filter(directive => directive.name.value === 'specifiedBy')?.[0];
    }
  }

  if ((type as unknown as { specifiedByUrl: string }).specifiedByUrl != null && specifiedByDirectiveNode == null) {
    specifiedByDirectiveNode = makeDirectiveNode('specifiedBy', {
      url: (type as unknown as { specifiedByUrl: string }).specifiedByUrl,
    });
  }

  const directives =
    specifiedByDirectiveNode == null
      ? directiveNodesBesidesSpecifiedBy
      : [specifiedByDirectiveNode].concat(directiveNodesBesidesSpecifiedBy);

  return {
    kind: Kind.SCALAR_TYPE_DEFINITION,
    description:
      type.astNode?.description ??
      (type.description
        ? {
            kind: Kind.STRING,
            value: type.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: type.name,
    },
    directives,
  };
}

export function astFromField(
  field: GraphQLField<any, any>,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): FieldDefinitionNode {
  return {
    kind: Kind.FIELD_DEFINITION,
    description:
      field.astNode?.description ??
      (field.description
        ? {
            kind: Kind.STRING,
            value: field.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: field.name,
    },
    arguments: field.args.map(arg => astFromArg(arg, schema, pathToDirectivesInExtensions)),
    type: astFromType(field.type),
    directives: getDeprecatableDirectiveNodes(field, schema, pathToDirectivesInExtensions),
  };
}

export function astFromInputField(
  field: GraphQLInputField,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): InputValueDefinitionNode {
  return {
    kind: Kind.INPUT_VALUE_DEFINITION,
    description:
      field.astNode?.description ??
      (field.description
        ? {
            kind: Kind.STRING,
            value: field.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: field.name,
    },
    type: astFromType(field.type),
    directives: getDeprecatableDirectiveNodes(field, schema, pathToDirectivesInExtensions),
    defaultValue: astFromValue(field.defaultValue, field.type) ?? undefined,
  };
}

export function astFromEnumValue(
  value: GraphQLEnumValue,
  schema: GraphQLSchema,
  pathToDirectivesInExtensions?: Array<string>
): EnumValueDefinitionNode {
  return {
    kind: Kind.ENUM_VALUE_DEFINITION,
    description:
      value.astNode?.description ??
      (value.description
        ? {
            kind: Kind.STRING,
            value: value.description,
            block: true,
          }
        : undefined),
    name: {
      kind: Kind.NAME,
      value: value.name,
    },
    directives: getDirectiveNodes(value, schema, pathToDirectivesInExtensions),
  };
}

export function makeDeprecatedDirective(deprecationReason: string): DirectiveNode {
  return makeDirectiveNode('deprecated', { reason: deprecationReason }, GraphQLDeprecatedDirective);
}

export function makeDirectiveNode(
  name: string,
  args: Record<string, any>,
  directive?: Maybe<GraphQLDirective>
): DirectiveNode {
  const directiveArguments: Array<ArgumentNode> = [];

  if (directive != null) {
    directive.args.forEach(arg => {
      const argName = arg.name;
      const argValue = args[argName];
      if (argValue !== undefined) {
        const value = astFromValue(argValue, arg.type);
        if (value) {
          directiveArguments.push({
            kind: Kind.ARGUMENT,
            name: {
              kind: Kind.NAME,
              value: argName,
            },
            value,
          });
        }
      }
    });
  } else {
    Object.entries(args).forEach(([argName, argValue]) => {
      const value = astFromValueUntyped(argValue);
      if (value) {
        directiveArguments.push({
          kind: Kind.ARGUMENT,
          name: {
            kind: Kind.NAME,
            value: argName,
          },
          value,
        });
      }
    });
  }

  return {
    kind: Kind.DIRECTIVE,
    name: {
      kind: Kind.NAME,
      value: name,
    },
    arguments: directiveArguments,
  };
}

export function makeDirectiveNodes(
  schema: Maybe<GraphQLSchema>,
  directiveValues: Record<string, any>
): Array<DirectiveNode> {
  const directiveNodes: Array<DirectiveNode> = [];
  Object.entries(directiveValues).forEach(([directiveName, arrayOrSingleValue]) => {
    const directive = schema?.getDirective(directiveName);
    if (Array.isArray(arrayOrSingleValue)) {
      arrayOrSingleValue.forEach(value => {
        directiveNodes.push(makeDirectiveNode(directiveName, value, directive));
      });
    } else {
      directiveNodes.push(makeDirectiveNode(directiveName, arrayOrSingleValue, directive));
    }
  });
  return directiveNodes;
}
