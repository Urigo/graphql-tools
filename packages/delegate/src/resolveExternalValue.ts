import {
  GraphQLResolveInfo,
  getNullableType,
  isCompositeType,
  isLeafType,
  isListType,
  GraphQLError,
  GraphQLSchema,
  GraphQLCompositeType,
  isAbstractType,
  GraphQLList,
  GraphQLType,
  locatedError,
} from 'graphql';

import { AggregateError, Maybe } from '@graphql-tools/utils';

import { StitchingInfo, SubschemaConfig } from './types';
import { annotateExternalObject, isExternalObject } from './externalObjects';
import { getFieldsNotInSubschema } from './getFieldsNotInSubschema';
import { mergeFields } from './mergeFields';
import { Subschema } from './Subschema';

export function resolveExternalValue(
  result: any,
  unpathedErrors: Array<GraphQLError>,
  subschema: GraphQLSchema | SubschemaConfig,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  returnType = info.returnType,
  skipTypeMerging?: boolean
): any {
  const type = getNullableType(returnType);

  if (result instanceof Error) {
    return result;
  }

  if (result == null) {
    return reportUnpathedErrorsViaNull(unpathedErrors);
  }

  if (isLeafType(type)) {
    return type.parseValue(result);
  } else if (isCompositeType(type)) {
    return resolveExternalObject(type, result, unpathedErrors, subschema, context, info, skipTypeMerging);
  } else if (isListType(type)) {
    return resolveExternalList(type, result, unpathedErrors, subschema, context, info, skipTypeMerging);
  }
}

function resolveExternalObject(
  type: GraphQLCompositeType,
  object: any,
  unpathedErrors: Array<GraphQLError>,
  subschema: GraphQLSchema | SubschemaConfig,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  skipTypeMerging?: boolean
) {
  // if we have already resolved this object, for example, when the identical object appears twice
  // in a list, see https://github.com/ardatan/graphql-tools/issues/2304
  if (isExternalObject(object)) {
    return object;
  }

  annotateExternalObject(object, unpathedErrors, subschema);

  const stitchingInfo: Maybe<StitchingInfo> = info?.schema.extensions?.['stitchingInfo'];
  if (skipTypeMerging || stitchingInfo == null) {
    return object;
  }

  let typeName: string;

  if (isAbstractType(type)) {
    const resolvedType = info.schema.getTypeMap()[object.__typename];
    if (resolvedType == null) {
      throw new Error(
        `Unable to resolve type '${object.__typename}'. Did you forget to include a transform that renames types? Did you delegate to the original subschema rather that the subschema config object containing the transform?`
      );
    }
    typeName = resolvedType.name;
  } else {
    typeName = type.name;
  }

  const mergedTypeInfo = stitchingInfo.mergedTypes[typeName];
  let targetSubschemas: undefined | Array<Subschema>;

  // Within the stitching context, delegation to a stitched GraphQLSchema or SubschemaConfig
  // will be redirected to the appropriate Subschema object, from which merge targets can be queried.
  if (mergedTypeInfo != null) {
    targetSubschemas = mergedTypeInfo.targetSubschemas.get(subschema as Subschema);
  }

  // If there are no merge targets from the subschema, return.
  if (!targetSubschemas) {
    return object;
  }

  const fieldNodes = getFieldsNotInSubschema(info, subschema, mergedTypeInfo);

  return mergeFields(
    mergedTypeInfo,
    typeName,
    object,
    fieldNodes,
    subschema as Subschema | Array<Subschema>,
    targetSubschemas,
    context,
    info
  );
}

function resolveExternalList(
  type: GraphQLList<any>,
  list: Array<any>,
  unpathedErrors: Array<GraphQLError>,
  subschema: GraphQLSchema | SubschemaConfig,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  skipTypeMerging?: boolean
) {
  return list.map(listMember =>
    resolveExternalListMember(
      getNullableType(type.ofType),
      listMember,
      unpathedErrors,
      subschema,
      context,
      info,
      skipTypeMerging
    )
  );
}

function resolveExternalListMember(
  type: GraphQLType,
  listMember: any,
  unpathedErrors: Array<GraphQLError>,
  subschema: GraphQLSchema | SubschemaConfig,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  skipTypeMerging?: boolean
): any {
  if (listMember instanceof Error) {
    return listMember;
  }

  if (listMember == null) {
    return reportUnpathedErrorsViaNull(unpathedErrors);
  }

  if (isLeafType(type)) {
    return type.parseValue(listMember);
  } else if (isCompositeType(type)) {
    return resolveExternalObject(type, listMember, unpathedErrors, subschema, context, info, skipTypeMerging);
  } else if (isListType(type)) {
    return resolveExternalList(type, listMember, unpathedErrors, subschema, context, info, skipTypeMerging);
  }
}

const reportedErrors: WeakMap<GraphQLError, boolean> = new Map();

function reportUnpathedErrorsViaNull(unpathedErrors: Array<GraphQLError>) {
  if (unpathedErrors.length) {
    const unreportedErrors: Array<GraphQLError> = [];
    unpathedErrors.forEach(error => {
      if (!reportedErrors.has(error)) {
        unreportedErrors.push(error);
        reportedErrors.set(error, true);
      }
    });

    if (unreportedErrors.length) {
      if (unreportedErrors.length === 1) {
        return unreportedErrors[0];
      }

      const combinedError = new AggregateError(unreportedErrors);
      // We cast path as any for GraphQL.js 14 compat
      // locatedError path argument must be defined, but it is just forwarded to a constructor that allows a undefined value
      // https://github.com/graphql/graphql-js/blob/b4bff0ba9c15c9d7245dd68556e754c41f263289/src/error/locatedError.js#L25
      // https://github.com/graphql/graphql-js/blob/b4bff0ba9c15c9d7245dd68556e754c41f263289/src/error/GraphQLError.js#L19
      return locatedError(combinedError, undefined as any, unreportedErrors[0].path as any);
    }
  }

  return null;
}
