import { buildSchema, GraphQLFieldResolver, GraphQLSchema } from 'graphql';

import { IMakeRemoteExecutableSchemaOptions } from './types';
import { delegateToSchema } from '@graphql-tools/delegate';

import { wrapSchema } from './wrapSchema';
import { Executor, Subscriber } from '@graphql-tools/utils';

export function makeRemoteExecutableSchema({
  schema: schemaOrTypeDefs,
  executor,
  subscriber,
  createResolver = defaultCreateRemoteResolver,
  buildSchemaOptions,
}: IMakeRemoteExecutableSchemaOptions): GraphQLSchema {
  const targetSchema =
    typeof schemaOrTypeDefs === 'string' ? buildSchema(schemaOrTypeDefs, buildSchemaOptions) : schemaOrTypeDefs;

  return wrapSchema({
    schema: targetSchema,
    createProxyingResolver: () => createResolver(executor, subscriber),
  });
}

export function defaultCreateRemoteResolver(
  executor: Executor,
  subscriber?: Subscriber | undefined
): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: { schema: info.schema, executor, subscriber },
      context,
      info,
    });
}
