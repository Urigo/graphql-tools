import { visit, Kind, SelectionSetNode, FragmentDefinitionNode, GraphQLError } from 'graphql';

import { Request, ExecutionResult, relocatedError } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '@graphql-tools/delegate';

export type QueryTransformer = (
  selectionSet: SelectionSetNode,
  fragments: Record<string, FragmentDefinitionNode>,
  delegationContext: DelegationContext,
  transformationContext: Record<string, any>
) => SelectionSetNode;

export type ResultTransformer = (
  result: any,
  delegationContext: DelegationContext,
  transformationContext: Record<string, any>
) => any;

export type ErrorPathTransformer = (path: ReadonlyArray<string | number>) => Array<string | number>;

export default class TransformQuery implements Transform {
  private readonly path: Array<string>;
  private readonly queryTransformer: QueryTransformer;
  private readonly resultTransformer: ResultTransformer;
  private readonly errorPathTransformer: ErrorPathTransformer;
  private readonly fragments: Record<string, FragmentDefinitionNode>;

  constructor({
    path,
    queryTransformer,
    resultTransformer = result => result,
    errorPathTransformer = errorPath => [...errorPath],
    fragments = {},
  }: {
    path: Array<string>;
    queryTransformer: QueryTransformer;
    resultTransformer?: ResultTransformer;
    errorPathTransformer?: ErrorPathTransformer;
    fragments?: Record<string, FragmentDefinitionNode>;
  }) {
    this.path = path;
    this.queryTransformer = queryTransformer;
    this.resultTransformer = resultTransformer;
    this.errorPathTransformer = errorPathTransformer;
    this.fragments = fragments;
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): Request {
    const pathLength = this.path.length;
    let index = 0;
    const document = visit(originalRequest.document, {
      [Kind.FIELD]: {
        enter: node => {
          if (index === pathLength || node.name.value !== this.path[index] || node.selectionSet == null) {
            return false;
          }

          index++;

          if (index === pathLength) {
            const selectionSet = this.queryTransformer(
              node.selectionSet,
              this.fragments,
              delegationContext,
              transformationContext
            );

            return {
              ...node,
              selectionSet,
            };
          }
        },
        leave: () => {
          index--;
        },
      },
    });

    return {
      ...originalRequest,
      document,
    };
  }

  public transformResult(
    originalResult: ExecutionResult,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): ExecutionResult {
    const data = this.transformData(originalResult.data, delegationContext, transformationContext);
    const errors = originalResult.errors;
    return {
      data,
      errors: errors != null ? this.transformErrors(errors) : undefined,
    };
  }

  private transformData(
    data: any,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): any {
    const leafIndex = this.path.length - 1;
    let index = 0;
    let newData = data;
    if (newData) {
      let next = this.path[index];
      while (index < leafIndex) {
        if (data[next]) {
          newData = newData[next];
        } else {
          break;
        }
        index++;
        next = this.path[index];
      }
      newData[next] = this.resultTransformer(newData[next], delegationContext, transformationContext);
    }
    return newData;
  }

  private transformErrors(errors: ReadonlyArray<GraphQLError>): ReadonlyArray<GraphQLError> {
    return errors.map(error => {
      const path: ReadonlyArray<string | number> | undefined = error.path;

      if (path == null) {
        return error;
      }

      let match = true;
      let index = 0;
      while (index < this.path.length) {
        if (path[index] !== this.path[index]) {
          match = false;
          break;
        }
        index++;
      }

      const newPath = match ? path.slice(0, index).concat(this.errorPathTransformer(path.slice(index))) : path;

      return relocatedError(error, newPath);
    });
  }
}
