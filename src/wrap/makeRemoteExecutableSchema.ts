import { ApolloLink } from 'apollo-link';
import {
  GraphQLFieldResolver,
  GraphQLSchema,
  BuildSchemaOptions,
} from 'graphql';

import { Fetcher } from '../Interfaces';
import { buildSchema } from '../polyfills/index';
import linkToFetcher from '../stitch/linkToFetcher';
import { delegateToSchema } from '../delegate';

import { wrapSchema } from './wrapSchema';

export default function makeRemoteExecutableSchema({
  schema: schemaOrTypeDefs,
  link,
  fetcher,
  createResolver = defaultCreateRemoteResolver,
  createSubscriptionResolver = defaultCreateRemoteSubscriptionResolver,
  buildSchemaOptions,
}: {
  schema: GraphQLSchema | string;
  link?: ApolloLink;
  fetcher?: Fetcher;
  createResolver?: (fetcher: Fetcher) => GraphQLFieldResolver<any, any>;
  createSubscriptionResolver?: (
    link: ApolloLink,
  ) => GraphQLFieldResolver<any, any>;
  buildSchemaOptions?: BuildSchemaOptions;
}): GraphQLSchema {
  let finalFetcher: Fetcher = fetcher;

  if (finalFetcher == null && link != null) {
    finalFetcher = linkToFetcher(link);
  }

  const targetSchema =
    typeof schemaOrTypeDefs === 'string'
      ? buildSchema(schemaOrTypeDefs, buildSchemaOptions)
      : schemaOrTypeDefs;

  return wrapSchema({
    schema: targetSchema,
    createProxyingResolver: (_schema, _transforms, operation) => {
      if (operation === 'query' || operation === 'mutation') {
        return createResolver(finalFetcher);
      }
      return createSubscriptionResolver(link);
    },
  });
}

export function defaultCreateRemoteResolver(
  fetcher: Fetcher,
): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: { schema: info.schema, fetcher },
      context,
      info,
    });
}

export function defaultCreateRemoteSubscriptionResolver(
  link: ApolloLink,
): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: { schema: info.schema, link },
      context,
      info,
    });
}
