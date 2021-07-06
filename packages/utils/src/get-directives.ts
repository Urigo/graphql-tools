import {
  GraphQLDirective,
  GraphQLSchema,
  SchemaDefinitionNode,
  TypeDefinitionNode,
  SchemaExtensionNode,
  TypeExtensionNode,
  GraphQLNamedType,
  GraphQLField,
  GraphQLInputField,
  FieldDefinitionNode,
  InputValueDefinitionNode,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLSchemaConfig,
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionTypeConfig,
  GraphQLScalarTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLInputObjectTypeConfig,
  GraphQLEnumValue,
  GraphQLEnumValueConfig,
  EnumValueDefinitionNode,
} from 'graphql';
import { Maybe } from '@graphql-tools/utils';

import { getArgumentValues } from './getArgumentValues';

export type DirectiveUseMap = { [key: string]: any };

type SchemaOrTypeNode =
  | SchemaDefinitionNode
  | SchemaExtensionNode
  | TypeDefinitionNode
  | TypeExtensionNode
  | EnumValueDefinitionNode
  | FieldDefinitionNode
  | InputValueDefinitionNode;

type DirectableGraphQLObject =
  | GraphQLSchema
  | GraphQLSchemaConfig
  | GraphQLNamedType
  | GraphQLObjectTypeConfig<any, any>
  | GraphQLInterfaceTypeConfig<any, any>
  | GraphQLUnionTypeConfig<any, any>
  | GraphQLScalarTypeConfig<any, any>
  | GraphQLEnumTypeConfig
  | GraphQLEnumValue
  | GraphQLEnumValueConfig
  | GraphQLInputObjectTypeConfig
  | GraphQLField<any, any>
  | GraphQLInputField
  | GraphQLFieldConfig<any, any>
  | GraphQLInputFieldConfig;

export function getDirectivesInExtensions(
  node: DirectableGraphQLObject,
  pathToDirectivesInExtensions = ['directives']
): Maybe<DirectiveUseMap> {
  const directivesInExtensions = pathToDirectivesInExtensions.reduce(
    (acc, pathSegment) => (acc == null ? acc : acc[pathSegment]),
    node?.extensions
  );

  return directivesInExtensions;
}

export function getDirectives(
  schema: GraphQLSchema,
  node: DirectableGraphQLObject,
  pathToDirectivesInExtensions = ['directives']
): DirectiveUseMap {
  const directivesInExtensions = getDirectivesInExtensions(node, pathToDirectivesInExtensions);

  if (directivesInExtensions != null) {
    return directivesInExtensions;
  }

  const schemaDirectives: ReadonlyArray<GraphQLDirective> =
    schema && schema.getDirectives ? schema.getDirectives() : [];

  const schemaDirectiveMap = schemaDirectives.reduce((schemaDirectiveMap, schemaDirective) => {
    schemaDirectiveMap[schemaDirective.name] = schemaDirective;
    return schemaDirectiveMap;
  }, {});

  let astNodes: Array<SchemaOrTypeNode> = [];
  if (node.astNode) {
    astNodes.push(node.astNode);
  }
  if ('extensionASTNodes' in node && node.extensionASTNodes) {
    astNodes = [...astNodes, ...node.extensionASTNodes];
  }

  const result: DirectiveUseMap = {};

  for (const astNode of astNodes) {
    if (astNode.directives) {
      for (const directiveNode of astNode.directives) {
        const schemaDirective = schemaDirectiveMap[directiveNode.name.value];
        if (schemaDirective) {
          if (schemaDirective.isRepeatable) {
            result[schemaDirective.name] = result[schemaDirective.name] ?? [];
            result[schemaDirective.name].push(getArgumentValues(schemaDirective, directiveNode));
          } else {
            result[schemaDirective.name] = getArgumentValues(schemaDirective, directiveNode);
          }
        }
      }
    }
  }

  return result;
}
