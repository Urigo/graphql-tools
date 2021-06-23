import {
  GraphQLSchema,
  DocumentNode,
  getIntrospectionQuery,
  buildClientSchema,
  parse,
  IntrospectionOptions,
  IntrospectionQuery,
} from 'graphql';

import { ValueOrPromise } from 'value-or-promise';

import { AsyncExecutor, Executor, SyncExecutor, ExecutionResult, AggregateError } from '@graphql-tools/utils';

function getSchemaFromIntrospection(introspectionResult: ExecutionResult<IntrospectionQuery>): GraphQLSchema {
  if (introspectionResult?.data?.__schema) {
    return buildClientSchema(introspectionResult.data);
  } else if (introspectionResult?.errors?.length) {
    if (introspectionResult.errors.length > 1) {
      const combinedError = new AggregateError(introspectionResult.errors, 'Could not obtain introspection result');
      throw combinedError;
    }
    const error = introspectionResult.errors[0];
    throw error.originalError || error;
  } else {
    throw new Error('Could not obtain introspection result, received: ' + JSON.stringify(introspectionResult));
  }
}

export function introspectSchema<TExecutor extends AsyncExecutor | SyncExecutor>(
  executor: TExecutor,
  context?: Record<string, any>,
  options?: IntrospectionOptions
): TExecutor extends AsyncExecutor ? Promise<GraphQLSchema> : GraphQLSchema {
  const parsedIntrospectionQuery: DocumentNode = parse(getIntrospectionQuery(options));
  return new ValueOrPromise(() =>
    (executor as Executor)<IntrospectionQuery>({
      document: parsedIntrospectionQuery,
      context,
    })
  )
    .then(introspection => getSchemaFromIntrospection(introspection))
    .resolve() as any;
}

// Keep for backwards compatibility. Will be removed on next release.
export function introspectSchemaSync(
  executor: SyncExecutor,
  context?: Record<string, any>,
  options?: IntrospectionOptions
) {
  return introspectSchema(executor, context, options);
}
