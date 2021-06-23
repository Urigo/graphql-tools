import { DocumentNode, GraphQLResolveInfo } from 'graphql';
import { ExecutionResult } from './Interfaces';

export interface ExecutionParams<TArgs extends Record<string, any> = Record<string, any>, TContext = any> {
  document: DocumentNode;
  variables?: TArgs;
  extensions?: Record<string, any>;
  context?: TContext;
  info?: GraphQLResolveInfo;
}

export type AsyncExecutor<TBaseContext = Record<string, any>> = <
  TReturn = Record<string, any>,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext
>(
  params: ExecutionParams<TArgs, TContext>
) => Promise<ExecutionResult<TReturn>>;
export type SyncExecutor<TBaseContext = Record<string, any>> = <
  TReturn = Record<string, any>,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext
>(
  params: ExecutionParams<TArgs, TContext>
) => ExecutionResult<TReturn>;
export type Executor<TBaseContext = Record<string, any>> = <
  TReturn = Record<string, any>,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext
>(
  params: ExecutionParams<TArgs, TContext>
) => ExecutionResult<TReturn> | Promise<ExecutionResult<TReturn>>;
export type Subscriber<TBaseContext = Record<string, any>> = <
  TReturn = Record<string, any>,
  TArgs = Record<string, any>,
  TContext extends TBaseContext = TBaseContext
>(
  params: ExecutionParams<TArgs, TContext>
) => Promise<AsyncIterableIterator<ExecutionResult<TReturn>> | ExecutionResult<TReturn>>;
