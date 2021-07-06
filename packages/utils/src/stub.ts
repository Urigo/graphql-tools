import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLInputObjectType,
  GraphQLString,
  GraphQLNamedType,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
  TypeNode,
  Kind,
  GraphQLType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLOutputType,
  GraphQLInputType,
} from 'graphql';

export function createNamedStub(name: string, type: 'object'): GraphQLObjectType;
export function createNamedStub(name: string, type: 'interface'): GraphQLInterfaceType;
export function createNamedStub(name: string, type: 'input'): GraphQLInputObjectType;
export function createNamedStub(
  name: string,
  type: any
): GraphQLObjectType | GraphQLInterfaceType | GraphQLInputObjectType {
  let constructor: any;
  if (type === 'object') {
    constructor = GraphQLObjectType;
  } else if (type === 'interface') {
    constructor = GraphQLInterfaceType;
  } else {
    constructor = GraphQLInputObjectType;
  }

  return new constructor({
    name,
    fields: {
      _fake: {
        type: GraphQLString,
      },
    },
  });
}

export function createStub(node: TypeNode, type: 'output'): GraphQLOutputType;
export function createStub(node: TypeNode, type: 'input'): GraphQLInputType;
export function createStub(node: TypeNode, type: 'output' | 'input'): GraphQLType;
export function createStub(node: TypeNode, type: any): any {
  switch (node.kind) {
    case Kind.LIST_TYPE:
      return new GraphQLList(createStub(node.type, type));
    case Kind.NON_NULL_TYPE:
      return new GraphQLNonNull(createStub(node.type, type));
    default:
      if (type === 'output') {
        return createNamedStub(node.name.value, 'object');
      }
      return createNamedStub(node.name.value, 'input');
  }
}

export function isNamedStub(type: GraphQLNamedType): boolean {
  if ('getFields' in type) {
    const fields = type.getFields();
    // eslint-disable-next-line no-unreachable-loop
    for (const fieldName in fields) {
      const field = fields[fieldName];
      return field.name === '_fake';
    }
  }

  return false;
}

export function getBuiltInForStub(type: GraphQLNamedType): GraphQLNamedType {
  switch (type.name) {
    case GraphQLInt.name:
      return GraphQLInt;
    case GraphQLFloat.name:
      return GraphQLFloat;
    case GraphQLString.name:
      return GraphQLString;
    case GraphQLBoolean.name:
      return GraphQLBoolean;
    case GraphQLID.name:
      return GraphQLID;
    default:
      return type;
  }
}
