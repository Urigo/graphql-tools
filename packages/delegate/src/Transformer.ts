import { Request, ExecutionResult } from '@graphql-tools/utils';

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
    delegationTransforms.forEach(transform => this.addTransform(transform, {}));
  }

  private addTransform(transform: Transform, context = {}) {
    this.transformations.push({ transform, context });
  }

  public transformRequest(originalRequest: Request) {
    return this.transformations.reduce(
      (request: Request, transformation: Transformation) =>
        transformation.transform.transformRequest != null
          ? transformation.transform.transformRequest(request, this.delegationContext, transformation.context)
          : request,
      originalRequest
    );
  }

  public transformResult(originalResult: ExecutionResult) {
    return this.transformations.reduceRight(
      (result: ExecutionResult, transformation: Transformation) =>
        transformation.transform.transformResult != null
          ? transformation.transform.transformResult(result, this.delegationContext, transformation.context)
          : result,
      originalResult
    );
  }
}
