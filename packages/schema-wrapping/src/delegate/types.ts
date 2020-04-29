import {
  GraphQLSchema,
  GraphQLOutputType,
  SelectionSetNode,
  FieldNode,
  DocumentNode,
  GraphQLResolveInfo,
  GraphQLFieldResolver,
  GraphQLNamedType,
} from 'graphql';
import { Operation, Transform, Request, TypeMap, ExecutionResult } from '@graphql-tools/utils';

export interface IDelegateToSchemaOptions<TContext = Record<string, any>, TArgs = Record<string, any>> {
  schema: GraphQLSchema | SubschemaConfig;
  operation?: Operation;
  fieldName?: string;
  returnType?: GraphQLOutputType;
  args?: TArgs;
  selectionSet?: SelectionSetNode;
  fieldNodes?: ReadonlyArray<FieldNode>;
  context?: TContext;
  info: GraphQLResolveInfo;
  rootValue?: Record<string, any>;
  transforms?: Array<Transform>;
  skipValidation?: boolean;
  skipTypeMerging?: boolean;
}

export interface IDelegateRequestOptions extends IDelegateToSchemaOptions {
  request: Request;
}

export interface ICreateRequestFromInfo {
  info: GraphQLResolveInfo;
  operation: Operation;
  fieldName: string;
  selectionSet?: SelectionSetNode;
  fieldNodes?: ReadonlyArray<FieldNode>;
}

export interface MergedTypeInfo {
  subschemas: Array<SubschemaConfig>;
  selectionSet?: SelectionSetNode;
  uniqueFields: Record<string, SubschemaConfig>;
  nonUniqueFields: Record<string, Array<SubschemaConfig>>;
  typeMaps: Map<SubschemaConfig, TypeMap>;
  selectionSets: Map<SubschemaConfig, SelectionSetNode>;
  containsSelectionSet: Map<SubschemaConfig, Map<SelectionSetNode, boolean>>;
}

export interface ExecutionParams<TArgs = Record<string, any>, TContext = any> {
  document: DocumentNode;
  variables?: TArgs;
  context?: TContext;
  info?: GraphQLResolveInfo;
}

export type AsyncExecutor = <
  TReturn = Record<string, any>,
  TArgs = Record<string, any>,
  TContext = Record<string, any>
>(
  params: ExecutionParams<TArgs, TContext>
) => Promise<ExecutionResult<TReturn>>;
export type SyncExecutor = <TReturn = Record<string, any>, TArgs = Record<string, any>, TContext = Record<string, any>>(
  params: ExecutionParams<TArgs, TContext>
) => ExecutionResult<TReturn>;
export type Executor = AsyncExecutor | SyncExecutor;
export type Subscriber = <TReturn = Record<string, any>, TArgs = Record<string, any>, TContext = Record<string, any>>(
  params: ExecutionParams<TArgs, TContext>
) => Promise<AsyncIterator<ExecutionResult<TReturn>> | ExecutionResult<TReturn>>;

export type CreateProxyingResolverFn = (
  schema: GraphQLSchema | SubschemaConfig,
  transforms: Array<Transform>,
  operation: Operation,
  fieldName: string
) => GraphQLFieldResolver<any, any>;

export interface SubschemaConfig {
  schema: GraphQLSchema;
  rootValue?: Record<string, any>;
  executor?: Executor;
  subscriber?: Subscriber;
  createProxyingResolver?: CreateProxyingResolverFn;
  transforms?: Array<Transform>;
  merge?: Record<string, MergedTypeConfig>;
}

export interface MergedTypeConfig {
  selectionSet?: string;
  fieldName?: string;
  args?: (originalResult: any) => Record<string, any>;
  resolve?: MergedTypeResolver;
}

export type MergedTypeResolver = (
  originalResult: any,
  context: Record<string, any>,
  info: GraphQLResolveInfo,
  subschema: GraphQLSchema | SubschemaConfig,
  selectionSet: SelectionSetNode
) => any;

export type SchemaLikeObject = SubschemaConfig | GraphQLSchema | string | DocumentNode | Array<GraphQLNamedType>;

export function isSubschemaConfig(value: any): value is SubschemaConfig {
  return Boolean((value as SubschemaConfig).schema);
}
