import {
  GraphQLSchema,
  GraphQLOutputType,
  SelectionSetNode,
  FieldNode,
  GraphQLResolveInfo,
  GraphQLFieldResolver,
  FragmentDefinitionNode,
  GraphQLObjectType,
  VariableDefinitionNode,
  OperationTypeNode,
  GraphQLError,
} from 'graphql';

import DataLoader from 'dataloader';

import { ExecutionRequest, ExecutionResult, Executor } from '@graphql-tools/utils';

import { Subschema } from './Subschema';
import { OBJECT_SUBSCHEMA_SYMBOL, FIELD_SUBSCHEMA_MAP_SYMBOL, UNPATHED_ERRORS_SYMBOL } from './symbols';
import { TypeMap } from 'graphql/type/schema';

export type SchemaTransform<TContext = Record<any, string>> = (
  originalWrappingSchema: GraphQLSchema,
  subschemaConfig: SubschemaConfig<any, any, any, TContext>,
  transformedSchema?: GraphQLSchema
) => GraphQLSchema;
export type RequestTransform<T = Record<string, any>> = (
  originalRequest: ExecutionRequest,
  delegationContext: DelegationContext,
  transformationContext: T
) => ExecutionRequest;
export type ResultTransform<T = Record<string, any>> = (
  originalResult: ExecutionResult,
  delegationContext: DelegationContext,
  transformationContext: T
) => ExecutionResult;

export interface Transform<T = any, TContext = Record<string, any>> {
  transformSchema?: SchemaTransform<TContext>;
  transformRequest?: RequestTransform<T>;
  transformResult?: ResultTransform<T>;
}

export interface DelegationContext<TContext = Record<string, any>> {
  subschema: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  subschemaConfig?: SubschemaConfig<any, any, any, TContext>;
  targetSchema: GraphQLSchema;
  operation: OperationTypeNode;
  fieldName: string;
  args?: Record<string, any>;
  context?: TContext;
  info?: GraphQLResolveInfo;
  returnType: GraphQLOutputType;
  onLocatedError?: (originalError: GraphQLError) => GraphQLError;
  rootValue?: any;
  transforms: Array<Transform<any, TContext>>;
  transformedSchema: GraphQLSchema;
  skipTypeMerging: boolean;
}

export interface IDelegateToSchemaOptions<TContext = Record<string, any>, TArgs = Record<string, any>> {
  schema: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  operationName?: string;
  operation?: OperationTypeNode;
  fieldName?: string;
  returnType?: GraphQLOutputType;
  onLocatedError?: (originalError: GraphQLError) => GraphQLError;
  args?: TArgs;
  selectionSet?: SelectionSetNode;
  fieldNodes?: ReadonlyArray<FieldNode>;
  context?: TContext;
  info: GraphQLResolveInfo;
  rootValue?: any;
  transforms?: Array<Transform<any, TContext>>;
  transformedSchema?: GraphQLSchema;
  validateRequest?: boolean;
  skipTypeMerging?: boolean;
}

export interface IDelegateRequestOptions<TContext = Record<string, any>, TArgs = Record<string, any>>
  extends IDelegateToSchemaOptions<TContext, TArgs> {
  request: ExecutionRequest;
}

export interface ICreateRequestFromInfo {
  info: GraphQLResolveInfo;
  rootValue?: any;
  operationName?: string;
  operation?: OperationTypeNode;
  fieldName?: string;
  selectionSet?: SelectionSetNode;
  fieldNodes?: ReadonlyArray<FieldNode>;
  context?: any;
}

export interface ICreateRequest {
  sourceSchema?: GraphQLSchema;
  sourceParentType?: GraphQLObjectType;
  sourceFieldName?: string;
  fragments?: Record<string, FragmentDefinitionNode>;
  variableDefinitions?: ReadonlyArray<VariableDefinitionNode>;
  variableValues?: Record<string, any>;
  targetOperation: OperationTypeNode;
  targetRootValue?: any;
  targetOperationName?: string;
  targetFieldName: string;
  selectionSet?: SelectionSetNode;
  fieldNodes?: ReadonlyArray<FieldNode>;
  context?: any;
  info?: GraphQLResolveInfo;
}

export interface MergedTypeInfo<TContext = Record<string, any>> {
  typeName: string;
  selectionSet?: SelectionSetNode;
  targetSubschemas: Map<Subschema<any, any, any, TContext>, Array<Subschema<any, any, any, TContext>>>;
  uniqueFields: Record<string, Subschema<any, any, any, TContext>>;
  nonUniqueFields: Record<string, Array<Subschema<any, any, any, TContext>>>;
  typeMaps: Map<GraphQLSchema | SubschemaConfig<any, any, any, TContext>, TypeMap>;
  selectionSets: Map<Subschema<any, any, any, TContext>, SelectionSetNode>;
  fieldSelectionSets: Map<Subschema<any, any, any, TContext>, Record<string, SelectionSetNode>>;
  resolvers: Map<Subschema<any, any, any, TContext>, MergedTypeResolver<TContext>>;
}

export interface ICreateProxyingResolverOptions<TContext = Record<string, any>> {
  subschemaConfig: SubschemaConfig<any, any, any, TContext>;
  transformedSchema?: GraphQLSchema;
  operation?: OperationTypeNode;
  fieldName?: string;
}

export type CreateProxyingResolverFn<TContext = Record<string, any>> = (
  options: ICreateProxyingResolverOptions<TContext>
) => GraphQLFieldResolver<any, TContext>;

export interface BatchingOptions<K = any, V = any, C = K> {
  extensionsReducer?: (mergedExtensions: Record<string, any>, request: ExecutionRequest) => Record<string, any>;
  dataLoaderOptions?: DataLoader.Options<K, V, C>;
}

export interface SubschemaConfig<K = any, V = any, C = K, TContext = Record<string, any>> {
  schema: GraphQLSchema;
  createProxyingResolver?: CreateProxyingResolverFn<TContext>;
  rootValue?: any;
  transforms?: Array<Transform<any, TContext>>;
  merge?: Record<string, MergedTypeConfig<any, any, TContext>>;
  executor?: Executor<TContext>;
  batch?: boolean;
  batchingOptions?: BatchingOptions<K, V, C>;
}

export interface MergedTypeConfig<K = any, V = any, TContext = Record<string, any>>
  extends MergedTypeEntryPoint<K, V, TContext> {
  entryPoints?: Array<MergedTypeEntryPoint>;
  fields?: Record<string, MergedFieldConfig>;
  computedFields?: Record<string, { selectionSet?: string }>;
  canonical?: boolean;
}

export interface MergedTypeEntryPoint<K = any, V = any, TContext = Record<string, any>>
  extends MergedTypeResolverOptions<K, V> {
  selectionSet?: string;
  key?: (originalResult: any) => K;
  resolve?: MergedTypeResolver<TContext>;
}

export interface MergedTypeResolverOptions<K = any, V = any> {
  fieldName?: string;
  args?: (originalResult: any) => Record<string, any>;
  argsFromKeys?: (keys: ReadonlyArray<K>) => Record<string, any>;
  valuesFromResults?: (results: any, keys: ReadonlyArray<K>) => Array<V>;
}

export interface MergedFieldConfig {
  selectionSet?: string;
  computed?: boolean;
  canonical?: boolean;
}

export type MergedTypeResolver<TContext = Record<string, any>> = (
  originalResult: any,
  context: TContext,
  info: GraphQLResolveInfo,
  subschema: GraphQLSchema | SubschemaConfig<any, any, any, TContext>,
  selectionSet: SelectionSetNode,
  key?: any
) => any;

export interface StitchingInfo<TContext = Record<string, any>> {
  subschemaMap: Map<GraphQLSchema | SubschemaConfig<any, any, any, TContext>, Subschema<any, any, any, TContext>>;
  fieldNodesByType: Record<string, Array<FieldNode>>;
  fieldNodesByField: Record<string, Record<string, Array<FieldNode>>>;
  dynamicSelectionSetsByField: Record<string, Record<string, Array<(node: FieldNode) => SelectionSetNode>>>;
  mergedTypes: Record<string, MergedTypeInfo<TContext>>;
}

export interface ExternalObject<TContext = Record<string, any>> {
  key: any;
  [OBJECT_SUBSCHEMA_SYMBOL]: GraphQLSchema | SubschemaConfig<any, any, any, TContext>;
  [FIELD_SUBSCHEMA_MAP_SYMBOL]: Record<string, GraphQLSchema | SubschemaConfig<any, any, any, TContext>>;
  [UNPATHED_ERRORS_SYMBOL]: Array<GraphQLError>;
}
