import {
  DefinitionNode,
  EnumTypeDefinitionNode,
  FieldDefinitionNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  InputObjectTypeDefinitionNode,
  InputValueDefinitionNode,
  InterfaceTypeDefinitionNode,
  Kind,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
  GraphQLDirective,
  DirectiveDefinitionNode,
  DirectiveLocationEnum,
  DirectiveLocation,
  GraphQLFieldConfig,
  StringValueNode,
  Location,
  TokenKind,
  GraphQLEnumValueConfigMap,
  GraphQLFieldConfigArgumentMap,
  valueFromASTUntyped,
  EnumValueDefinitionNode,
  getDirectiveValues,
  GraphQLDeprecatedDirective,
} from 'graphql';

import { createStub, createNamedStub, Maybe } from '@graphql-tools/utils';

const backcompatOptions = { commentDescriptions: true };

export default function typeFromAST(node: DefinitionNode): GraphQLNamedType | GraphQLDirective | null {
  switch (node.kind) {
    case Kind.OBJECT_TYPE_DEFINITION:
      return makeObjectType(node);
    case Kind.INTERFACE_TYPE_DEFINITION:
      return makeInterfaceType(node);
    case Kind.ENUM_TYPE_DEFINITION:
      return makeEnumType(node);
    case Kind.UNION_TYPE_DEFINITION:
      return makeUnionType(node);
    case Kind.SCALAR_TYPE_DEFINITION:
      return makeScalarType(node);
    case Kind.INPUT_OBJECT_TYPE_DEFINITION:
      return makeInputObjectType(node);
    case Kind.DIRECTIVE_DEFINITION:
      return makeDirective(node);
    default:
      return null;
  }
}

function makeObjectType(node: ObjectTypeDefinitionNode): GraphQLObjectType {
  const config = {
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    interfaces: () => node.interfaces?.map(iface => createNamedStub(iface.name.value, 'interface')),
    fields: () => (node.fields != null ? makeFields(node.fields) : {}),
    astNode: node,
  };
  return new GraphQLObjectType(config);
}

function makeInterfaceType(node: InterfaceTypeDefinitionNode): GraphQLInterfaceType {
  const config = {
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    interfaces: (node as unknown as ObjectTypeDefinitionNode).interfaces?.map(iface =>
      createNamedStub(iface.name.value, 'interface')
    ),
    fields: () => (node.fields != null ? makeFields(node.fields) : {}),
    astNode: node,
  };
  return new GraphQLInterfaceType(config);
}

function makeEnumType(node: EnumTypeDefinitionNode): GraphQLEnumType {
  const values =
    node.values?.reduce<GraphQLEnumValueConfigMap>(
      (prev, value) => ({
        ...prev,
        [value.name.value]: {
          description: getDescription(value, backcompatOptions),
          deprecationReason: getDeprecationReason(value),
          astNode: value,
        },
      }),
      {}
    ) ?? {};

  return new GraphQLEnumType({
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    values,
    astNode: node,
  });
}

function makeUnionType(node: UnionTypeDefinitionNode): GraphQLUnionType {
  return new GraphQLUnionType({
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    types: () => node.types?.map(type => createNamedStub(type.name.value, 'object')) ?? [],
    astNode: node,
  });
}

function makeScalarType(node: ScalarTypeDefinitionNode): GraphQLScalarType {
  return new GraphQLScalarType({
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    astNode: node,
    // TODO: serialize default property setting can be dropped once
    // upstream graphql-js TypeScript typings are updated, likely in v16
    serialize: value => value,
  });
}

function makeInputObjectType(node: InputObjectTypeDefinitionNode): GraphQLInputObjectType {
  return new GraphQLInputObjectType({
    name: node.name.value,
    description: getDescription(node, backcompatOptions),
    fields: () => (node.fields ? makeValues(node.fields) : {}),
    astNode: node,
  });
}

function makeFields(nodes: ReadonlyArray<FieldDefinitionNode>): Record<string, GraphQLFieldConfig<any, any>> {
  return nodes.reduce(
    (prev, node) => ({
      ...prev,
      [node.name.value]: {
        type: createStub(node.type, 'output'),
        description: getDescription(node, backcompatOptions),
        args: makeValues(node.arguments ?? []),
        deprecationReason: getDeprecationReason(node),
        astNode: node,
      },
    }),
    {}
  );
}

function makeValues(nodes: ReadonlyArray<InputValueDefinitionNode>): GraphQLFieldConfigArgumentMap {
  return nodes.reduce(
    (prev, node) => ({
      ...prev,
      [node.name.value]: {
        type: createStub(node.type, 'input'),
        defaultValue: node.defaultValue !== undefined ? valueFromASTUntyped(node.defaultValue) : undefined,
        description: getDescription(node, backcompatOptions),
        astNode: node,
      },
    }),
    {}
  );
}

function makeDirective(node: DirectiveDefinitionNode): GraphQLDirective {
  const locations: Array<DirectiveLocationEnum> = [];
  node.locations.forEach(location => {
    if (location.value in DirectiveLocation) {
      locations.push(location.value as DirectiveLocationEnum);
    }
  });
  return new GraphQLDirective({
    name: node.name.value,
    description: node.description != null ? node.description.value : null,
    locations,
    isRepeatable: node.repeatable,
    args: makeValues(node.arguments ?? []),
    astNode: node,
  });
}

// graphql < v13 does not export getDescription

function getDescription(
  node: { description?: StringValueNode; loc?: Location },
  options?: { commentDescriptions?: boolean }
): string | undefined {
  if (node.description != null) {
    return node.description.value;
  }
  if (options?.commentDescriptions) {
    const rawValue = getLeadingCommentBlock(node);
    if (rawValue !== undefined) {
      return dedentBlockStringValue(`\n${rawValue as string}`);
    }
  }
}

function getLeadingCommentBlock(node: { description?: StringValueNode; loc?: Location }): void | string {
  const loc = node.loc;
  if (!loc) {
    return;
  }
  const comments = [];
  let token = loc.startToken.prev;
  while (
    token != null &&
    token.kind === TokenKind.COMMENT &&
    token.next != null &&
    token.prev != null &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value);
    comments.push(value);
    token = token.prev;
  }
  return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}

function dedentBlockStringValue(rawString: string): string {
  // Expand a block string's raw value into independent lines.
  const lines = rawString.split(/\r\n|[\n\r]/g);

  // Remove common indentation from all lines but first.
  const commonIndent = getBlockStringIndentation(lines);

  if (commonIndent !== 0) {
    for (let i = 1; i < lines.length; i++) {
      lines[i] = lines[i].slice(commonIndent);
    }
  }

  // Remove leading and trailing blank lines.
  while (lines.length > 0 && isBlank(lines[0])) {
    lines.shift();
  }
  while (lines.length > 0 && isBlank(lines[lines.length - 1])) {
    lines.pop();
  }

  // Return a string of the lines joined with U+000A.
  return lines.join('\n');
}
/**
 * @internal
 */
export function getBlockStringIndentation(lines: ReadonlyArray<string>): number {
  let commonIndent = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const indent = leadingWhitespace(line);
    if (indent === line.length) {
      continue; // skip empty lines
    }

    if (commonIndent === null || indent < commonIndent) {
      commonIndent = indent;
      if (commonIndent === 0) {
        break;
      }
    }
  }

  return commonIndent === null ? 0 : commonIndent;
}

function leadingWhitespace(str: string) {
  let i = 0;
  while (i < str.length && (str[i] === ' ' || str[i] === '\t')) {
    i++;
  }
  return i;
}

function isBlank(str: string) {
  return leadingWhitespace(str) === str.length;
}

function getDeprecationReason(node: EnumValueDefinitionNode | FieldDefinitionNode): Maybe<string> {
  const deprecated = getDirectiveValues(GraphQLDeprecatedDirective, node);
  return deprecated?.['reason'];
}
