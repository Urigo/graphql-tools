import {
  GraphQLResolveInfo,
  GraphQLOutputType,
  GraphQLSchema,
  GraphQLError,
  responsePathAsArray,
  locatedError,
} from 'graphql';

import { AggregateError, getResponseKeyFromInfo, ExecutionResult, relocatedError } from '@graphql-tools/utils';

import { SubschemaConfig, Transform, DelegationContext } from '../types';
import { resolveExternalValue } from '../resolveExternalValue';

export default class CheckResultAndHandleErrors implements Transform {
  public transformResult(
    originalResult: ExecutionResult,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): ExecutionResult {
    return checkResultAndHandleErrors(
      originalResult,
      delegationContext.context != null ? delegationContext.context : {},
      delegationContext.info,
      delegationContext.fieldName,
      delegationContext.subschema,
      delegationContext.returnType,
      delegationContext.skipTypeMerging,
      delegationContext.onLocatedError
    );
  }
}

export function checkResultAndHandleErrors(
  result: ExecutionResult,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  responseKey: string = getResponseKeyFromInfo(info),
  subschema: GraphQLSchema | SubschemaConfig,
  returnType: GraphQLOutputType = info.returnType,
  skipTypeMerging?: boolean,
  onLocatedError?: (originalError: GraphQLError) => GraphQLError
): any {
  const { data, unpathedErrors } = mergeDataAndErrors(
    result.data == null ? undefined : result.data[responseKey],
    result.errors == null ? [] : result.errors,
    info != null && info.path ? responsePathAsArray(info.path) : undefined,
    onLocatedError
  );

  return resolveExternalValue(data, unpathedErrors, subschema, context, info, returnType, skipTypeMerging);
}

export function mergeDataAndErrors(
  data: any,
  errors: ReadonlyArray<GraphQLError>,
  path: Array<string | number> | undefined,
  onLocatedError?: (originalError: GraphQLError) => GraphQLError,
  index = 1
): { data: any; unpathedErrors: Array<GraphQLError> } {
  if (data == null) {
    if (!errors.length) {
      return { data: null, unpathedErrors: [] };
    }

    if (errors.length === 1) {
      const error = onLocatedError ? onLocatedError(errors[0]) : errors[0];
      const newPath =
        path === undefined ? error.path : error.path === undefined ? path : path.concat(error.path.slice(1));

      return { data: relocatedError(errors[0], newPath), unpathedErrors: [] };
    }

    // We cast path as any for GraphQL.js 14 compat
    // locatedError path argument must be defined, but it is just forwarded to a constructor that allows a undefined value
    // https://github.com/graphql/graphql-js/blob/b4bff0ba9c15c9d7245dd68556e754c41f263289/src/error/locatedError.js#L25
    // https://github.com/graphql/graphql-js/blob/b4bff0ba9c15c9d7245dd68556e754c41f263289/src/error/GraphQLError.js#L19
    const newError = locatedError(new AggregateError(errors), undefined as any, path as any);

    return { data: newError, unpathedErrors: [] };
  }

  if (!errors.length) {
    return { data, unpathedErrors: [] };
  }

  const unpathedErrors: Array<GraphQLError> = [];

  const errorMap = new Map<string | number, Array<GraphQLError>>();
  for (const error of errors) {
    const pathSegment = error.path?.[index];
    if (pathSegment != null) {
      let pathSegmentErrors = errorMap.get(pathSegment);
      if (pathSegmentErrors === undefined) {
        pathSegmentErrors = [error];
        errorMap.set(pathSegment, pathSegmentErrors);
      } else {
        pathSegmentErrors.push(error);
      }
    } else {
      unpathedErrors.push(error);
    }
  }

  for (const [pathSegment, pathSegmentErrors] of errorMap) {
    if (data[pathSegment] !== undefined) {
      const { data: newData, unpathedErrors: newErrors } = mergeDataAndErrors(
        data[pathSegment],
        pathSegmentErrors,
        path,
        onLocatedError,
        index + 1
      );
      data[pathSegment] = newData;
      unpathedErrors.push(...newErrors);
    } else {
      unpathedErrors.push(...pathSegmentErrors);
    }
  }

  return { data, unpathedErrors };
}
