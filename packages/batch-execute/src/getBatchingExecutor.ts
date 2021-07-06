import DataLoader from 'dataloader';

import { ExecutionParams, Executor } from '@graphql-tools/utils';
import { createBatchingExecutor } from './createBatchingExecutor';
import { memoize2of4 } from './memoize';

export const getBatchingExecutor = memoize2of4(function (
  _context: Record<string, any>,
  executor: Executor,
  dataLoaderOptions?: DataLoader.Options<any, any, any> | undefined,
  extensionsReducer?:
    | undefined
    | ((mergedExtensions: Record<string, any>, executionParams: ExecutionParams) => Record<string, any>)
): Executor {
  return createBatchingExecutor(executor, dataLoaderOptions, extensionsReducer);
});
