import { getOperationAST } from 'graphql';

import DataLoader from 'dataloader';

import { ValueOrPromise } from 'value-or-promise';

import { ExecutionParams, Executor, ExecutionResult } from '@graphql-tools/utils';

import { mergeExecutionParams } from './mergeExecutionParams';
import { splitResult } from './splitResult';

export function createBatchingExecutor(
  executor: Executor,
  dataLoaderOptions?: DataLoader.Options<any, any, any>,
  extensionsReducer: (
    mergedExtensions: Record<string, any>,
    executionParams: ExecutionParams
  ) => Record<string, any> = defaultExtensionsReducer
): Executor {
  const loader = new DataLoader(createLoadFn(executor, extensionsReducer), dataLoaderOptions);
  return (executionParams: ExecutionParams) => loader.load(executionParams);
}

function createLoadFn(
  executor: Executor,
  extensionsReducer: (mergedExtensions: Record<string, any>, executionParams: ExecutionParams) => Record<string, any>
) {
  return async (execs: ReadonlyArray<ExecutionParams>): Promise<Array<ExecutionResult>> => {
    const execBatches: Array<Array<ExecutionParams>> = [];
    let index = 0;
    const exec = execs[index];
    let currentBatch: Array<ExecutionParams> = [exec];
    execBatches.push(currentBatch);

    const operationType = getOperationAST(exec.document, undefined)?.operation;
    if (operationType == null) {
      throw new Error('Could not identify operation type of document.');
    }

    while (++index < execs.length) {
      const currentOperationType = getOperationAST(execs[index].document, undefined)?.operation;
      if (operationType == null) {
        throw new Error('Could not identify operation type of document.');
      }

      if (operationType === currentOperationType) {
        currentBatch.push(execs[index]);
      } else {
        currentBatch = [execs[index]];
        execBatches.push(currentBatch);
      }
    }

    const executionResults: Array<ValueOrPromise<ExecutionResult>> = [];
    execBatches.forEach(execBatch => {
      const mergedExecutionParams = mergeExecutionParams(execBatch, extensionsReducer);
      executionResults.push(new ValueOrPromise(() => executor(mergedExecutionParams)));
    });

    return ValueOrPromise.all(executionResults)
      .then(resultBatches => {
        let results: Array<ExecutionResult> = [];
        resultBatches.forEach((resultBatch, index) => {
          results = [...results, ...splitResult(resultBatch!, execBatches[index].length)];
        });
        return results;
      })
      .resolve();
  };
}

function defaultExtensionsReducer(
  mergedExtensions: Record<string, any>,
  executionParams: ExecutionParams
): Record<string, any> {
  const newExtensions = executionParams.extensions;
  if (newExtensions != null) {
    Object.assign(mergedExtensions, newExtensions);
  }
  return mergedExtensions;
}
