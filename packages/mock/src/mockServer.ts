import { TypeSource } from '@graphql-tools/utils';
import { GraphQLSchema, isSchema, graphql, buildASTSchema } from 'graphql';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { addMocksToSchema } from './addMocksToSchema';
import { IMockServer, IMocks } from './types';

/**
 * A convenience wrapper on top of addMocksToSchema. It adds your mock resolvers
 * to your schema and returns a client that will correctly execute your query with
 * variables. Note: when executing queries from the returned server, context and
 * root will both equal `{}`.
 * @param schema The schema to which to add mocks. This can also be a set of type
 * definitions instead.
 * @param mocks The mocks to add to the schema.
 * @param preserveResolvers Set to `true` to prevent existing resolvers from being
 * overwritten to provide mock data. This can be used to mock some parts of the
 * server and not others.
 */
export function mockServer(schema: TypeSource, mocks: IMocks, preserveResolvers = false): IMockServer {
  let mySchema: GraphQLSchema;
  if (!isSchema(schema)) {
    // TODO: provide useful error messages here if this fails
    mySchema = buildASTSchema(mergeTypeDefs(schema));
  } else {
    mySchema = schema;
  }

  mySchema = addMocksToSchema({ schema: mySchema, mocks, preserveResolvers });

  return { query: (query, vars) => graphql(mySchema, query, {}, {}, vars) };
}
