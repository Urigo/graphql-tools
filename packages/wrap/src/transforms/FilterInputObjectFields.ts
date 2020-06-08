import { GraphQLSchema, GraphQLInputFieldConfig } from 'graphql';

import { Transform, Request, InputFieldFilter } from '@graphql-tools/utils';

import TransformInputObjectFields from './TransformInputObjectFields';
import { InputObjectNodeTransformer } from '../types';

export default class FilterInputObjectFields implements Transform {
  private readonly transformer: TransformInputObjectFields;

  constructor(filter: InputFieldFilter, inputObjectNodeTransformer?: InputObjectNodeTransformer) {
    this.transformer = new TransformInputObjectFields(
      (typeName: string, fieldName: string, inputFieldConfig: GraphQLInputFieldConfig) =>
        filter(typeName, fieldName, inputFieldConfig) ? undefined : null,
      undefined,
      inputObjectNodeTransformer
    );
  }

  public transformSchema(originalSchema: GraphQLSchema): GraphQLSchema {
    return this.transformer.transformSchema(originalSchema);
  }

  public transformRequest(originalRequest: Request, delegationContext?: Record<string, any>): Request {
    return this.transformer.transformRequest(originalRequest, delegationContext);
  }
}
