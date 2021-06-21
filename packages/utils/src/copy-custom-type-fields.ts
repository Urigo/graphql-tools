import { GraphQLNamedType, GraphQLSchema } from 'graphql';

export function copyCustomFields(
  schema: GraphQLSchema,
  source: GraphQLNamedType,
  target: GraphQLNamedType
) {
  const customFields: string[] = schema.extensions?.customFields ?? [];
  customFields.forEach(customField => {
    if (source[customField]) {
      target[customField] = source[customField];
    }
  });
  return target;
}
