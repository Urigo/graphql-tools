import { ExecutionRequest, ExecutionResult } from '@graphql-tools/utils';

import { DelegationContext, Transform } from './types';

import { prepareGatewayDocument } from './prepareGatewayDocument';
import { finalizeGatewayRequest } from './finalizeGatewayRequest';
import { checkResultAndHandleErrors } from './checkResultAndHandleErrors';

interface Transformation {
  transform: Transform;
  context: Record<string, any>;
}

export class Transformer<TContext = Record<string, any>> {
  private transformations: Array<Transformation> = [];
  private delegationContext: DelegationContext<any>;

  constructor(context: DelegationContext<TContext>) {
    this.delegationContext = context;
    const transforms = context.transforms;
    const delegationTransforms = transforms.slice().reverse();
    for (const transform of delegationTransforms) {
      this.addTransform(transform, {});
    }
  }

  private addTransform(transform: Transform, context = {}) {
    this.transformations.push({ transform, context });
  }

  public transformRequest(originalRequest: ExecutionRequest): ExecutionRequest {
    const preparedRequest = {
      ...originalRequest,
      document: prepareGatewayDocument(originalRequest.document, this.delegationContext),
    };

    const transformedRequest = this.transformations.reduce(
      (request: ExecutionRequest, transformation: Transformation) =>
        transformation.transform.transformRequest != null
          ? transformation.transform.transformRequest(request, this.delegationContext, transformation.context)
          : request,
      preparedRequest
    );

    return finalizeGatewayRequest(transformedRequest, this.delegationContext);
  }

  public transformResult(originalResult: ExecutionResult): any {
    const transformedResult = this.transformations.reduceRight(
      (result: ExecutionResult, transformation: Transformation) =>
        transformation.transform.transformResult != null
          ? transformation.transform.transformResult(result, this.delegationContext, transformation.context)
          : result,
      originalResult
    );

    return checkResultAndHandleErrors(transformedResult, this.delegationContext);
  }
}
