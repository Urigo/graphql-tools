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
} from 'graphql';

import { ValueOrPromise } from 'value-or-promise';

import { getBatchingExecutor } from '@graphql-tools/batch-execute';

import {
  mapAsyncIterator,
  Executor,
  ExecutionParams,
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

export function delegateToSchema<TContext = Record<string, any>, TArgs = any>(
  options: IDelegateToSchemaOptions<TContext, TArgs>
): any {
  const {
    info,
    operationName,
    operation = getDelegatingOperation(info.parentType, info.schema),
    fieldName = info.fieldName,
    returnType = info.returnType,
    selectionSet,
    fieldNodes,
  } = options;

  const request = createRequestFromInfo({
    info,
    operation,
    fieldName,
    selectionSet,
    fieldNodes,
    operationName,
  });

  return delegateRequest({
    ...options,
    request,
    operation,
    fieldName,
    returnType,
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

export function delegateRequest<TContext = Record<string, any>, TArgs = any>(
  options: IDelegateRequestOptions<TContext, TArgs>
) {
  const delegationContext = getDelegationContext(options);

  const transformer = new Transformer<TContext>(delegationContext, options.binding);

  const processedRequest = transformer.transformRequest(options.request);

  if (options.validateRequest) {
    validateRequest(delegationContext, processedRequest.document);
  }

  const { context, info } = delegationContext;

  const executor = getExecutor(delegationContext);

  return new ValueOrPromise(() =>
    executor({
      ...processedRequest,
      context,
      info,
    })
  )
    .then(originalResult => {
      if (isAsyncIterable(originalResult)) {
        // "subscribe" to the subscription result and map the result through the transforms
        return mapAsyncIterator(originalResult, originalResult => ({
          [delegationContext.fieldName]: transformer.transformResult(originalResult),
        }));
      }
      return transformer.transformResult(originalResult);
    })
    .resolve();
}

const emptyObject = {};

function getDelegationContext<TContext>({
  request,
  schema,
  operation,
  fieldName,
  returnType,
  args = {},
  context,
  info,
  rootValue = emptyObject,
  transforms = [],
  transformedSchema,
  skipTypeMerging = false,
  operationName,
}: IDelegateRequestOptions<TContext>): DelegationContext<TContext> {
  let operationDefinition: Maybe<OperationDefinitionNode>;
  let targetOperation: Maybe<OperationTypeNode>;
  let targetFieldName: string;
  let targetOperationName: string | undefined;

  if (operation == null) {
    operationDefinition = getOperationAST(request.document, request.operationName);
    if (operationDefinition == null) {
      throw new Error('Cannot infer main operation from the provided document.');
    }
    targetOperation = operationDefinition.operation;
  } else {
    targetOperation = operation;
  }

  if (fieldName == null) {
    operationDefinition = operationDefinition ?? getOperationAST(request.document, request.operationName);
    targetFieldName = (operationDefinition?.selectionSet.selections[0] as unknown as FieldDefinitionNode).name.value;
  } else {
    targetFieldName = fieldName;
  }

  if (operationName == null) {
    if (request.operationName) {
      targetOperationName = request.operationName;
    } else if (operationDefinition?.name?.value) {
      targetOperationName = operationDefinition.name.value;
    }
  } else {
    targetOperationName = operationName;
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
      operation: targetOperation,
      operationName: targetOperationName,
      fieldName: targetFieldName,
      args,
      context,
      info,
      rootValue: rootValue ?? emptyObject,
      returnType:
        returnType ?? info?.returnType ?? getDelegationReturnType(targetSchema, targetOperation, targetFieldName),
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
    operation: targetOperation,
    fieldName: targetFieldName,
    args,
    context,
    info,
    rootValue: rootValue,
    returnType:
      returnType ??
      info?.returnType ??
      getDelegationReturnType(subschemaOrSubschemaConfig, targetOperation, targetFieldName),
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

  let executor: Executor = subschemaConfig?.executor || getDefaultExecutor(targetSchema);

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

const schemaDefaultExecutorMap = new WeakMap<GraphQLSchema, Executor>();

function getDefaultExecutor(schema: GraphQLSchema) {
  let executor = schemaDefaultExecutorMap.get(schema);
  if (!executor) {
    executor = createDefaultExecutor(schema);
    schemaDefaultExecutorMap.set(schema, executor);
  }
  return executor;
}

function createDefaultExecutor(schema: GraphQLSchema) {
  return function defaultExecutor({ document, context, variables, rootValue, info }: ExecutionParams) {
    const executionParams = {
      schema,
      document,
      contextValue: context,
      variableValues: variables,
      rootValue,
    };
    if (info?.operation?.operation === 'subscription') {
      return subscribe(executionParams);
    }
    return execute(executionParams);
  } as Executor;
}
