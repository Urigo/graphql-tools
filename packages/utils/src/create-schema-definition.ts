import { GraphQLObjectType } from 'graphql';

export function createSchemaDefinition(
  def: {
    query: string | GraphQLObjectType | null;
    mutation: string | GraphQLObjectType | null;
    subscription: string | GraphQLObjectType | null;
  },
  config?: {
    force?: boolean;
  }
): string | undefined {
  const schemaRoot: {
    query?: string;
    mutation?: string;
    subscription?: string;
  } = {};

  if (def.query) {
    schemaRoot.query = def.query.toString();
  }

  if (def.mutation) {
    schemaRoot.mutation = def.mutation.toString();
  }

  if (def.subscription) {
    schemaRoot.subscription = def.subscription.toString();
  }

  const fields = Object.keys(schemaRoot)
    .map(rootType => (schemaRoot[rootType] ? `${rootType}: ${schemaRoot[rootType]}` : null))
    .filter(a => a);

  if (fields.length) {
    return `schema { ${fields.join('\n')} }`;
  }

  if (config && config.force) {
    return ` schema { query: Query } `;
  }

  return undefined;
}
