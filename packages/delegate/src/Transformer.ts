import { ExecutionRequest, ExecutionResult } from '@graphql-tools/utils';

import { DelegationContext, DelegationBinding, Transform } from './types';

import { defaultDelegationBinding } from './delegationBindings';

interface Transformation {
  transform: Transform;
  context: Record<string, any>;
}

export class Transformer<TContext = Record<string, any>> {
  private transformations: Array<Transformation> = [];
  private delegationContext: DelegationContext<any>;

  constructor(context: DelegationContext<TContext>, binding: DelegationBinding<TContext> = defaultDelegationBinding) {
    this.delegationContext = context;
    const delegationTransforms: Array<Transform> = binding(this.delegationContext);
    for (const transform of delegationTransforms) {
      this.addTransform(transform, {});
    }
  }

  private addTransform(transform: Transform, context = {}) {
    this.transformations.push({ transform, context });
  }

  public transformRequest(originalRequest: ExecutionRequest) {
    let request = originalRequest;
    for (const transformation of this.transformations) {
      if (transformation.transform.transformRequest) {
        request = transformation.transform.transformRequest(request, this.delegationContext, transformation.context);
      }
    }

    return request;
  }

  public transformResult(originalResult: ExecutionResult) {
    let result = originalResult;

    // from rigth to left
    for (let i = this.transformations.length - 1; i >= 0; i--) {
      const transformation = this.transformations[i];
      if (transformation.transform.transformResult) {
        result = transformation.transform.transformResult(result, this.delegationContext, transformation.context);
      }
    }

    return result;
  }
}
