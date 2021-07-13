import {
  subscribe,
  execute,
  validate,
  GraphQLSchema,
  FieldDefinitionNode,
  getOperationAST,
  OperationTypeNode,
  OperationDefinitionNode,
  DocumentNode,
  GraphQLOutputType,
  ExecutionArgs,
  print,
} from 'graphql';

import { ValueOrPromise } from 'value-or-promise';

import { getBatchingExecutor } from '@graphql-tools/batch-execute';

import {
  mapAsyncIterator,
  Executor,
  ExecutionRequest,
  Maybe,
  AggregateError,
  isAsyncIterable,
  getDefinedRootType,
} from '@graphql-tools/utils';

import {
  IDelegateToSchemaOptions,
  IDelegateRequestOptions,
  StitchingInfo,
  DelegationContext,
  SubschemaConfig,
} from './types';

import { isSubschemaConfig } from './subschemaConfig';
import { Subschema } from './Subschema';
import { createRequestFromInfo, getDelegatingOperation } from './createRequest';
import { Transformer } from './Transformer';
import lru, { Lru } from 'tiny-lru';

export function delegateToSchema<TContext = Record<string, any>, TArgs = any>(
  options: IDelegateToSchemaOptions<TContext, TArgs>
): any {
  const {
    info,
    schema,
    rootValue,
    operationName,
    operation = getDelegatingOperation(info.parentType, info.schema),
    fieldName = info.fieldName,
    selectionSet,
    fieldNodes,
    context,
  } = options;

  const request = createRequestFromInfo({
    info,
    operation,
    fieldName,
    selectionSet,
    fieldNodes,
    rootValue: rootValue ?? (schema as SubschemaConfig).rootValue,
    operationName,
    context,
  });

  return delegateRequest({
    ...options,
    request,
  });
}

function getDelegationReturnType(
  targetSchema: GraphQLSchema,
  operation: OperationTypeNode,
  fieldName: string
): GraphQLOutputType {
  const rootType = getDefinedRootType(targetSchema, operation);
  return rootType.getFields()[fieldName].type;
}

const DEFAULT_MAX = 1000;
const DEFAULT_TTL = 3600000;

const processedRequestCacheBySchema = new WeakMap<GraphQLSchema | SubschemaConfig, Lru<ExecutionRequest>>();

function getProcessedRequestCache(subschema: GraphQLSchema | SubschemaConfig) {
  let processedRequestCache = processedRequestCacheBySchema.get(subschema);
  if (!processedRequestCache) {
    processedRequestCache = lru(DEFAULT_MAX, DEFAULT_TTL);
    processedRequestCacheBySchema.set(subschema, processedRequestCache);
  }
  return processedRequestCache;
}

function getRequestCacheKey(request: ExecutionRequest, delegationContext: DelegationContext) {
  return `${print(request.document)}_${request.operationName}_${JSON.stringify(request.variables)}_${
    delegationContext.fieldName
  }_${delegationContext.returnType}_${JSON.stringify(delegationContext.args)}`;
}

function getProcessedRequest(
  request: ExecutionRequest,
  delegationContext: DelegationContext<any>,
  transformer: Transformer
): ExecutionRequest {
  const cacheKey = getRequestCacheKey(request, delegationContext);
  const processedRequestCache = getProcessedRequestCache(delegationContext.subschema);
  let processedRequest = processedRequestCache.get(cacheKey);
  if (!processedRequest) {
    processedRequest = transformer.transformRequest(request);
    processedRequestCache.set(cacheKey, {
      document: processedRequest.document,
      operationType: processedRequest.operationType,
      variables: processedRequest.variables,
      operationName: processedRequest.operationName,
    });
  }
  return {
    ...processedRequest,
    extensions: request.extensions,
    rootValue: request.rootValue,
    context: request.context,
    info: request.info,
  };
}

export function delegateRequest<TContext = Record<string, any>, TArgs = any>(
  options: IDelegateRequestOptions<TContext, TArgs>
) {
  const delegationContext = getDelegationContext(options);

  const transformer = new Transformer<TContext>(delegationContext, options.binding);

  const processedRequest = getProcessedRequest(options.request, delegationContext, transformer);

  if (options.validateRequest) {
    validateRequest(delegationContext, processedRequest.document);
  }

  const executor = getExecutor(delegationContext);

  return new ValueOrPromise(() => executor(processedRequest))
    .then(originalResult => {
      if (isAsyncIterable(originalResult)) {
        // "subscribe" to the subscription result and map the result through the transforms
        return mapAsyncIterator(originalResult, result => transformer.transformResult(result));
      }
      return transformer.transformResult(originalResult);
    })
    .resolve();
}

function getDelegationContext<TContext>({
  request,
  schema,
  fieldName,
  returnType,
  args,
  info,
  transforms = [],
  transformedSchema,
  skipTypeMerging = false,
}: IDelegateRequestOptions<TContext>): DelegationContext<TContext> {
  const { operationType: operation, context, operationName, document } = request;
  let operationDefinition: Maybe<OperationDefinitionNode>;
  let targetFieldName: string;

  if (fieldName == null) {
    operationDefinition = getOperationAST(document, operationName);
    if (operationDefinition == null) {
      throw new Error('Cannot infer main operation from the provided document.');
    }
    targetFieldName = (operationDefinition?.selectionSet.selections[0] as unknown as FieldDefinitionNode).name.value;
  } else {
    targetFieldName = fieldName;
  }

  const stitchingInfo: Maybe<StitchingInfo<TContext>> = info?.schema.extensions?.['stitchingInfo'];

  const subschemaOrSubschemaConfig: GraphQLSchema | SubschemaConfig<any, any, any, any> =
    stitchingInfo?.subschemaMap.get(schema) ?? schema;

  if (isSubschemaConfig(subschemaOrSubschemaConfig)) {
    const targetSchema = subschemaOrSubschemaConfig.schema;
    return {
      subschema: schema,
      subschemaConfig: subschemaOrSubschemaConfig,
      targetSchema,
      operation,
      fieldName: targetFieldName,
      args,
      context,
      info,
      returnType: returnType ?? info?.returnType ?? getDelegationReturnType(targetSchema, operation, targetFieldName),
      transforms:
        subschemaOrSubschemaConfig.transforms != null
          ? subschemaOrSubschemaConfig.transforms.concat(transforms)
          : transforms,
      transformedSchema:
        transformedSchema ??
        (subschemaOrSubschemaConfig instanceof Subschema ? subschemaOrSubschemaConfig.transformedSchema : targetSchema),
      skipTypeMerging,
    };
  }

  return {
    subschema: schema,
    subschemaConfig: undefined,
    targetSchema: subschemaOrSubschemaConfig,
    operation,
    fieldName: targetFieldName,
    args,
    context,
    info,
    returnType:
      returnType ?? info?.returnType ?? getDelegationReturnType(subschemaOrSubschemaConfig, operation, targetFieldName),
    transforms,
    transformedSchema: transformedSchema ?? subschemaOrSubschemaConfig,
    skipTypeMerging,
  };
}

function validateRequest(delegationContext: DelegationContext<any>, document: DocumentNode) {
  const errors = validate(delegationContext.targetSchema, document);
  if (errors.length > 0) {
    if (errors.length > 1) {
      const combinedError = new AggregateError(errors);
      throw combinedError;
    }
    const error = errors[0];
    throw error.originalError || error;
  }
}

function getExecutor<TContext>(delegationContext: DelegationContext<TContext>): Executor<TContext> {
  const { subschemaConfig, targetSchema, context } = delegationContext;

  let executor: Executor = subschemaConfig?.executor || createDefaultExecutor(targetSchema);

  if (subschemaConfig?.batch) {
    const batchingOptions = subschemaConfig?.batchingOptions;
    executor = getBatchingExecutor(
      context ?? globalThis ?? window ?? global,
      executor,
      batchingOptions?.dataLoaderOptions,
      batchingOptions?.extensionsReducer
    );
  }

  return executor;
}

const defaultExecutorCache = new WeakMap<GraphQLSchema, Executor>();

function createDefaultExecutor(schema: GraphQLSchema): Executor {
  let defaultExecutor = defaultExecutorCache.get(schema);
  if (!defaultExecutor) {
    defaultExecutor = function defaultExecutor({
      document,
      context,
      variables,
      rootValue,
      operationName,
      operationType,
    }: ExecutionRequest) {
      const executionArgs: ExecutionArgs = {
        schema,
        document,
        contextValue: context,
        variableValues: variables,
        rootValue,
        operationName,
      };
      if (operationType === 'subscription') {
        return subscribe(executionArgs);
      }
      return execute(executionArgs);
    } as Executor;
    defaultExecutorCache.set(schema, defaultExecutor);
  }
  return defaultExecutor;
}
