import {
  ASTNode,
  EnumTypeDefinitionNode,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  ListValueNode,
  NamedTypeNode,
  ObjectTypeDefinitionNode,
  ScalarTypeDefinitionNode,
  UnionTypeDefinitionNode,
} from 'graphql';

export function assertGraphQLObjectType(input: unknown): asserts input is GraphQLObjectType {
  if (input instanceof GraphQLObjectType) {
    return;
  }
  throw new Error('Expected GraphQLObjectType.');
}
export function assertGraphQLEnumType(input: unknown): asserts input is GraphQLEnumType {
  if (input instanceof GraphQLEnumType) {
    return;
  }
  throw new Error('Expected GraphQLObjectType.');
}
export function assertGraphQLScalerType(input: unknown): asserts input is GraphQLScalarType {
  if (input instanceof GraphQLScalarType) {
    return;
  }
  throw new Error('Expected GraphQLScalerType.');
}
export function assertGraphQLInterfaceType(input: unknown): asserts input is GraphQLInterfaceType {
  if (input instanceof GraphQLInterfaceType) {
    return;
  }
  throw new Error('Expected GraphQLInterfaceType.');
}
export function assertGraphQLUnionType(input: unknown): asserts input is GraphQLUnionType {
  if (input instanceof GraphQLUnionType) {
    return;
  }
  throw new Error('Expected GraphQLUnionType.');
}
export function assertGraphQLInputObjectType(input: unknown): asserts input is GraphQLInputObjectType {
  if (input instanceof GraphQLInputObjectType) {
    return;
  }
  throw new Error('Expected GraphQLInputObjectType.');
}

export function assertEnumTypeDefinitionNode(input: ASTNode): asserts input is EnumTypeDefinitionNode {
  if (input.kind === 'EnumTypeDefinition') {
    return;
  }
  throw new Error('Expected EnumTypeDefinitionNode.');
}
export function assertObjectTypeDefinitionNode(input: ASTNode): asserts input is ObjectTypeDefinitionNode {
  if (input.kind === 'ObjectTypeDefinition') {
    return;
  }
  throw new Error(`Expected ObjectTypeDefinitionNode. Got ${input.kind}`);
}
export function assertInterfaceTypeDefinitionNode(input: ASTNode): asserts input is InterfaceTypeDefinitionNode {
  if (input.kind === 'InterfaceTypeDefinition') {
    return;
  }
  throw new Error(`Expected InterfaceTypeDefinitionNode. Got ${input.kind}`);
}
export function assertUnionTypeDefinitionNode(input: ASTNode): asserts input is UnionTypeDefinitionNode {
  if (input.kind === 'UnionTypeDefinition') {
    return;
  }
  throw new Error(`Expected InterfaceTypeDefinitionNode. Got ${input.kind}`);
}
export function assertNamedTypeNode(input: ASTNode): asserts input is NamedTypeNode {
  if (input.kind === 'NamedType') {
    return;
  }
  throw new Error(`Expected NamedTypeNode. Got ${input.kind}`);
}
export function assertScalarTypeDefinitionNode(input: ASTNode): asserts input is ScalarTypeDefinitionNode {
  if (input.kind === 'ScalarTypeDefinition') {
    return;
  }
  throw new Error(`Expected ScalarTypeDefinitionNode. Got ${input.kind}`);
}
export function assertInputObjectTypeDefinitionNode(input: ASTNode): asserts input is InputObjectTypeDefinitionNode {
  if (input.kind === 'InputObjectTypeDefinition') {
    return;
  }
  throw new Error(`Expected InputObjectTypeDefinitionNode. Got ${input.kind}`);
}
export function assertListValueNode(input: ASTNode): asserts input is ListValueNode {
  if (input.kind === 'ListValue') {
    return;
  }
  throw new Error(`Expected ListValueNode. Got ${input.kind}`);
}
