import { DocumentNode, GraphQLResolveInfo } from 'graphql';
import { ExecutionResult } from './Interfaces';

type MaybePromise<T> = Promise<T> | T;
type MaybeAsyncIterableIterator<T> = AsyncIterableIterator<T> | T;

export interface ExecutionParams<
  TArgs extends Record<string, any> = Record<string, any>,
  TContext = any,
  TRootValue = any,
  TExtensions = Record<string, any>
> {
  document: DocumentNode;
  variables?: TArgs;
  extensions?: TExtensions;
  context?: TContext;
  info?: GraphQLResolveInfo;
  rootValue?: TRootValue;
  operationName?: string;
}

export type AsyncExecutor<TBaseContext = Record<string, any>, TBaseExtensions = Record<string, any>> = <
  TReturn = any,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext,
  TRoot = any,
  TExtensions extends TBaseExtensions = TBaseExtensions
>(
  params: ExecutionParams<TArgs, TContext, TRoot, TExtensions>
) => Promise<MaybeAsyncIterableIterator<ExecutionResult<TReturn>>>;

export type SyncExecutor<TBaseContext = Record<string, any>, TBaseExtensions = Record<string, any>> = <
  TReturn = any,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext,
  TRoot = any,
  TExtensions extends TBaseExtensions = TBaseExtensions
>(
  params: ExecutionParams<TArgs, TContext, TRoot, TExtensions>
) => ExecutionResult<TReturn>;

export type Executor<TBaseContext = Record<string, any>, TBaseExtensions = Record<string, any>> = <
  TReturn = any,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext,
  TRoot = any,
  TExtensions extends TBaseExtensions = TBaseExtensions
>(
  params: ExecutionParams<TArgs, TContext, TRoot, TExtensions>
) => MaybePromise<MaybeAsyncIterableIterator<ExecutionResult<TReturn>>>;
