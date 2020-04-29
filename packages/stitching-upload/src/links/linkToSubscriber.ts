import { ApolloLink, execute, FetchResult, Observable } from 'apollo-link';

import { observableToAsyncIterable } from './observableToAsyncIterable';
import { GraphQLResolveInfo, DocumentNode } from 'graphql';

export const linkToSubscriber = (link: ApolloLink) => async <TReturn, TArgs, TContext>({
  document,
  variables,
  context,
  info,
}: {
  document: DocumentNode;
  variables: TArgs;
  context: TContext;
  info: GraphQLResolveInfo;
}) =>
  observableToAsyncIterable(
    execute(link, {
      query: document,
      variables,
      context: {
        graphqlContext: context,
        graphqlResolveInfo: info,
      },
    }) as Observable<FetchResult<TReturn>>
  );
