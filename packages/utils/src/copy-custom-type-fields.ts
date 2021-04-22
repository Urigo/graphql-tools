import { GraphQLNamedType } from 'graphql';

const customFields = ['resolveObject', 'resolveReference'];

export function copyCustomFields(
  source: GraphQLNamedType,
  target: GraphQLNamedType
) {
  customFields.forEach(customField => {
    if (source[customField]) {
      target[customField] = source[customField];
    }
  });
  return target;
}
