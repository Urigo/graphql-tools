import {
  GraphQLSchema,
  getOperationRootType,
  getOperationAST,
  Kind,
  GraphQLObjectType,
  FieldNode,
  GraphQLOutputType,
  isListType,
  getNullableType,
  isAbstractType,
  isObjectType,
  OperationDefinitionNode,
  GraphQLError,
  TypeNameMetaFieldDef,
} from 'graphql';

import { Request, GraphQLExecutionContext, ExecutionResult } from './Interfaces';
import { collectFields } from './collectFields';
import { Maybe } from '@graphql-tools/utils';

export type ValueVisitor = (value: any) => any;

export type ObjectValueVisitor = {
  __enter?: ValueVisitor;
  __leave?: ValueVisitor;
} & Record<string, ValueVisitor>;

export type ResultVisitorMap = Record<string, ValueVisitor | ObjectValueVisitor>;

export type ErrorVisitor = (error: GraphQLError, pathIndex: number) => GraphQLError;

export type ErrorVisitorMap = {
  __unpathed?: (error: GraphQLError) => GraphQLError;
} & Record<string, Record<string, ErrorVisitor>>;

interface SegmentInfo {
  type: GraphQLObjectType;
  fieldName: string;
  pathIndex: number;
}

interface ErrorInfo {
  segmentInfoMap: Map<GraphQLError, Array<SegmentInfo>>;
  unpathedErrors: Set<GraphQLError>;
}

interface SortedErrors {
  errorMap: Record<string, Array<GraphQLError>>;
  unpathedErrors: Set<GraphQLError>;
}

export function visitData(data: any, enter?: ValueVisitor, leave?: ValueVisitor): any {
  if (Array.isArray(data)) {
    return data.map(value => visitData(value, enter, leave));
  } else if (typeof data === 'object') {
    const newData = enter != null ? enter(data) : data;

    if (newData != null) {
      for (const key in newData) {
        const value = newData[key];
        newData[key] = visitData(value, enter, leave);
      }
    }

    return leave != null ? leave(newData) : newData;
  }

  return data;
}

export function visitErrors(
  errors: ReadonlyArray<GraphQLError>,
  visitor: (error: GraphQLError) => GraphQLError
): Array<GraphQLError> {
  return errors.map(error => visitor(error));
}
export function visitResult(
  result: ExecutionResult,
  request: Request,
  schema: GraphQLSchema,
  resultVisitorMap?: ResultVisitorMap,
  errorVisitorMap?: ErrorVisitorMap
): any {
  const partialExecutionContext = {
    schema,
    fragments: request.document.definitions.reduce((acc, def) => {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        acc[def.name.value] = def;
      }
      return acc;
    }, {}),
    variableValues: request.variables,
  } as GraphQLExecutionContext;

  const errorInfo: ErrorInfo = {
    segmentInfoMap: new Map<GraphQLError, Array<SegmentInfo>>(),
    unpathedErrors: new Set<GraphQLError>(),
  };

  const data = result.data;
  const errors = result.errors;
  const visitingErrors = errors != null && errorVisitorMap != null;

  const operationDocumentNode = getOperationAST(request.document, undefined);

  if (data != null && operationDocumentNode != null) {
    result.data = visitRoot(
      data,
      operationDocumentNode,
      partialExecutionContext,
      resultVisitorMap,
      visitingErrors ? errors : undefined,
      errorInfo
    );
  }

  if (errors != null && errorVisitorMap) {
    result.errors = visitErrorsByType(errors, errorVisitorMap, errorInfo);
  }

  return result;
}

function visitErrorsByType(
  errors: ReadonlyArray<GraphQLError>,
  errorVisitorMap: ErrorVisitorMap,
  errorInfo: ErrorInfo
): Array<GraphQLError> {
  const segmentInfoMap = errorInfo.segmentInfoMap;
  const unpathedErrors = errorInfo.unpathedErrors;
  const unpathedErrorVisitor = errorVisitorMap['__unpathed'];

  return errors.map(originalError => {
    const pathSegmentsInfo = segmentInfoMap.get(originalError);
    const newError =
      pathSegmentsInfo == null
        ? originalError
        : pathSegmentsInfo.reduceRight((acc, segmentInfo) => {
            const typeName = segmentInfo.type.name;
            const typeVisitorMap = errorVisitorMap[typeName];
            if (typeVisitorMap == null) {
              return acc;
            }
            const errorVisitor = typeVisitorMap[segmentInfo.fieldName];
            return errorVisitor == null ? acc : errorVisitor(acc, segmentInfo.pathIndex);
          }, originalError);

    if (unpathedErrorVisitor && unpathedErrors.has(originalError)) {
      return unpathedErrorVisitor(newError);
    }

    return newError;
  });
}

function visitRoot(
  root: any,
  operation: OperationDefinitionNode,
  exeContext: GraphQLExecutionContext,
  resultVisitorMap: Maybe<ResultVisitorMap>,
  errors: Maybe<ReadonlyArray<GraphQLError>>,
  errorInfo: ErrorInfo
): any {
  const operationRootType = getOperationRootType(exeContext.schema, operation);
  const collectedFields = collectFields(
    exeContext,
    operationRootType,
    operation.selectionSet,
    Object.create(null),
    Object.create(null)
  );

  return visitObjectValue(root, operationRootType, collectedFields, exeContext, resultVisitorMap, 0, errors, errorInfo);
}

function visitObjectValue(
  object: Record<string, any>,
  type: GraphQLObjectType,
  fieldNodeMap: Record<string, Array<FieldNode>>,
  exeContext: GraphQLExecutionContext,
  resultVisitorMap: Maybe<ResultVisitorMap>,
  pathIndex: number,
  errors: Maybe<ReadonlyArray<GraphQLError>>,
  errorInfo: ErrorInfo
): Record<string, any> {
  const fieldMap = type.getFields();
  const typeVisitorMap = resultVisitorMap?.[type.name] as ObjectValueVisitor;

  const enterObject = typeVisitorMap?.__enter as ValueVisitor;
  const newObject = enterObject != null ? enterObject(object) : object;

  let sortedErrors: SortedErrors;
  let errorMap: Maybe<Record<string, Array<GraphQLError>>> = null;
  if (errors != null) {
    sortedErrors = sortErrorsByPathSegment(errors, pathIndex);
    errorMap = sortedErrors.errorMap;
    for (const error of sortedErrors.unpathedErrors) {
      errorInfo.unpathedErrors.add(error);
    }
  }

  for (const responseKey in fieldNodeMap) {
    const subFieldNodes = fieldNodeMap[responseKey];
    const fieldName = subFieldNodes[0].name.value;
    const fieldType = fieldName === '__typename' ? TypeNameMetaFieldDef.type : fieldMap[fieldName].type;

    const newPathIndex = pathIndex + 1;

    let fieldErrors: Array<GraphQLError> | undefined;
    if (errorMap) {
      fieldErrors = errorMap[responseKey];
      if (fieldErrors != null) {
        delete errorMap[responseKey];
      }
      addPathSegmentInfo(type, fieldName, newPathIndex, fieldErrors, errorInfo);
    }

    const newValue = visitFieldValue(
      object[responseKey],
      fieldType,
      subFieldNodes,
      exeContext,
      resultVisitorMap,
      newPathIndex,
      fieldErrors,
      errorInfo
    );

    updateObject(newObject, responseKey, newValue, typeVisitorMap, fieldName);
  }

  const oldTypename = newObject.__typename;
  if (oldTypename != null) {
    updateObject(newObject, '__typename', oldTypename, typeVisitorMap, '__typename');
  }

  if (errorMap) {
    for (const errors of Object.values(errorMap)) {
      for (const error of errors) {
        errorInfo.unpathedErrors.add(error);
      }
    }
  }

  const leaveObject = typeVisitorMap?.__leave as ValueVisitor;

  return leaveObject != null ? leaveObject(newObject) : newObject;
}

function updateObject(
  object: Record<string, any>,
  responseKey: string,
  newValue: any,
  typeVisitorMap: ObjectValueVisitor,
  fieldName: string
): void {
  if (typeVisitorMap == null) {
    object[responseKey] = newValue;
    return;
  }

  const fieldVisitor = typeVisitorMap[fieldName];
  if (fieldVisitor == null) {
    object[responseKey] = newValue;
    return;
  }

  const visitedValue = fieldVisitor(newValue);
  if (visitedValue === undefined) {
    delete object[responseKey];
    return;
  }

  object[responseKey] = visitedValue;
}

function visitListValue(
  list: Array<any>,
  returnType: GraphQLOutputType,
  fieldNodes: Array<FieldNode>,
  exeContext: GraphQLExecutionContext,
  resultVisitorMap: Maybe<ResultVisitorMap>,
  pathIndex: number,
  errors: ReadonlyArray<GraphQLError>,
  errorInfo: ErrorInfo
): Array<any> {
  return list.map(listMember =>
    visitFieldValue(listMember, returnType, fieldNodes, exeContext, resultVisitorMap, pathIndex + 1, errors, errorInfo)
  );
}

function visitFieldValue(
  value: any,
  returnType: GraphQLOutputType,
  fieldNodes: Array<FieldNode>,
  exeContext: GraphQLExecutionContext,
  resultVisitorMap: Maybe<ResultVisitorMap>,
  pathIndex: number,
  errors: ReadonlyArray<GraphQLError> | undefined = [],
  errorInfo: ErrorInfo
): any {
  if (value == null) {
    return value;
  }

  const nullableType = getNullableType(returnType);
  if (isListType(nullableType)) {
    return visitListValue(
      value as Array<any>,
      nullableType.ofType,
      fieldNodes,
      exeContext,
      resultVisitorMap,
      pathIndex,
      errors,
      errorInfo
    );
  } else if (isAbstractType(nullableType)) {
    const finalType = exeContext.schema.getType(value.__typename) as GraphQLObjectType;
    const collectedFields = collectSubFields(exeContext, finalType, fieldNodes);
    return visitObjectValue(
      value,
      finalType,
      collectedFields,
      exeContext,
      resultVisitorMap,
      pathIndex,
      errors,
      errorInfo
    );
  } else if (isObjectType(nullableType)) {
    const collectedFields = collectSubFields(exeContext, nullableType, fieldNodes);
    return visitObjectValue(
      value,
      nullableType,
      collectedFields,
      exeContext,
      resultVisitorMap,
      pathIndex,
      errors,
      errorInfo
    );
  }

  const typeVisitorMap = resultVisitorMap?.[nullableType.name] as ValueVisitor;
  if (typeVisitorMap == null) {
    return value;
  }

  const visitedValue = typeVisitorMap(value);
  return visitedValue === undefined ? value : visitedValue;
}

function sortErrorsByPathSegment(errors: ReadonlyArray<GraphQLError>, pathIndex: number): SortedErrors {
  const errorMap = Object.create(null);
  const unpathedErrors: Set<GraphQLError> = new Set();
  for (const error of errors) {
    const pathSegment = error.path?.[pathIndex];
    if (pathSegment == null) {
      unpathedErrors.add(error);
      continue;
    }

    if (pathSegment in errorMap) {
      errorMap[pathSegment].push(error);
    } else {
      errorMap[pathSegment] = [error];
    }
  }

  return {
    errorMap,
    unpathedErrors,
  };
}

function addPathSegmentInfo(
  type: GraphQLObjectType,
  fieldName: string,
  pathIndex: number,
  errors: ReadonlyArray<GraphQLError> = [],
  errorInfo: ErrorInfo
) {
  for (const error of errors) {
    const segmentInfo = {
      type,
      fieldName,
      pathIndex,
    };
    const pathSegmentsInfo = errorInfo.segmentInfoMap.get(error);
    if (pathSegmentsInfo == null) {
      errorInfo.segmentInfoMap.set(error, [segmentInfo]);
    } else {
      pathSegmentsInfo.push(segmentInfo);
    }
  }
}

function collectSubFields(
  exeContext: GraphQLExecutionContext,
  type: GraphQLObjectType,
  fieldNodes: Array<FieldNode>
): Record<string, Array<FieldNode>> {
  let subFieldNodes: Record<string, Array<FieldNode>> = Object.create(null);
  const visitedFragmentNames = Object.create(null);

  for (const fieldNode of fieldNodes) {
    if (fieldNode.selectionSet) {
      subFieldNodes = collectFields(exeContext, type, fieldNode.selectionSet, subFieldNodes, visitedFragmentNames);
    }
  }

  return subFieldNodes;
}
