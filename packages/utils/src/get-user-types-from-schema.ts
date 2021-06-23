import { GraphQLSchema, GraphQLObjectType, isObjectType } from 'graphql';

/**
 * Get all GraphQL types from schema without:
 *
 * - Query, Mutation, Subscription objects
 * - Internal scalars added by parser
 *
 * @param schema
 */
export function getUserTypesFromSchema(schema: GraphQLSchema): GraphQLObjectType[] {
  const allTypesMap = schema.getTypeMap();

  // tslint:disable-next-line: no-unnecessary-local-variable
  const modelTypes = Object.values(allTypesMap).filter((graphqlType): graphqlType is GraphQLObjectType => {
    if (isObjectType(graphqlType)) {
      // Filter out private types
      if (graphqlType.name.startsWith('__')) {
        return false;
      }
      const schemaMutationType = schema.getMutationType();
      if (schemaMutationType && graphqlType.name === schemaMutationType.name) {
        return false;
      }
      const schemaQueryType = schema.getMutationType();
      if (schemaQueryType && graphqlType.name === schemaQueryType.name) {
        return false;
      }
      const schemaSubscriptionType = schema.getMutationType();
      if (schemaSubscriptionType && graphqlType.name === schemaSubscriptionType.name) {
        return false;
      }

      return true;
    }

    return false;
  });

  return modelTypes;
}
