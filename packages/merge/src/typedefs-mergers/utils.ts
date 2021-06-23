import { TypeNode, NamedTypeNode, ListTypeNode, NonNullTypeNode, Source, Kind } from 'graphql';

export function isStringTypes(types: any): types is string {
  return typeof types === 'string';
}

export function isSourceTypes(types: any): types is Source {
  return types instanceof Source;
}

export function extractType(type: TypeNode): NamedTypeNode {
  let visitedType = type;
  while (visitedType.kind === Kind.LIST_TYPE || visitedType.kind === 'NonNullType') {
    visitedType = visitedType.type;
  }
  return visitedType;
}

export function isWrappingTypeNode(type: TypeNode): type is ListTypeNode | NonNullTypeNode {
  return type.kind !== Kind.NAMED_TYPE;
}

export function isListTypeNode(type: TypeNode): type is ListTypeNode {
  return type.kind === Kind.LIST_TYPE;
}

export function isNonNullTypeNode(type: TypeNode): type is NonNullTypeNode {
  return type.kind === Kind.NON_NULL_TYPE;
}

export function printTypeNode(type: TypeNode): string {
  if (isListTypeNode(type)) {
    return `[${printTypeNode(type.type)}]`;
  }

  if (isNonNullTypeNode(type)) {
    return `${printTypeNode(type.type)}!`;
  }

  return type.name.value;
}

export enum CompareVal {
  A_SMALLER_THAN_B = -1,
  A_EQUALS_B = 0,
  A_GREATER_THAN_B = 1,
}
export type CompareFn<T> = (a: T | undefined, b: T | undefined) => -1 | 0 | 1;

export function defaultStringComparator(a: string | undefined, b: string | undefined): CompareVal {
  if (a == null && b == null) {
    return CompareVal.A_EQUALS_B;
  }
  if (a == null) {
    return CompareVal.A_SMALLER_THAN_B;
  }
  if (b == null) {
    return CompareVal.A_GREATER_THAN_B;
  }
  if (a < b) return CompareVal.A_SMALLER_THAN_B;
  if (a > b) return CompareVal.A_GREATER_THAN_B;
  return CompareVal.A_EQUALS_B;
}
