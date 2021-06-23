import { GraphQLType, GraphQLSchema, doTypesOverlap, isCompositeType } from 'graphql';
import { Maybe } from '@graphql-tools/utils';

export function implementsAbstractType(schema: GraphQLSchema, typeA: Maybe<GraphQLType>, typeB: Maybe<GraphQLType>) {
  if (typeB == null || typeA == null) {
    return false;
  } else if (typeA === typeB) {
    return true;
  } else if (isCompositeType(typeA) && isCompositeType(typeB)) {
    return doTypesOverlap(schema, typeA, typeB);
  }

  return false;
}
