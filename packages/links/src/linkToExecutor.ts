import { toPromise } from '@apollo/client/core';
import { ApolloLink, execute } from '@apollo/client/link/core';
import { Observable } from '@apollo/client/utilities';

import { Executor, ExecutionParams, ExecutionResult, observableToAsyncIterable } from '@graphql-tools/utils';

export const linkToExecutor =
  (link: ApolloLink): Executor =>
  async <TReturn, TArgs, TContext>(params: ExecutionParams<TArgs, TContext>) => {
    const { document, variables, extensions, context, info, operationName } = params;
    const observable = execute(link, {
      query: document,
      variables,
      context: {
        graphqlContext: context,
        graphqlResolveInfo: info,
        clientAwareness: {},
      },
      extensions,
      operationName,
    }) as Observable<ExecutionResult<TReturn>>;
    if (info?.operation.operation === 'subscription') {
      return observableToAsyncIterable<ExecutionResult<TReturn>>(observable)[Symbol.asyncIterator]();
    }
    return toPromise(observable);
  };
