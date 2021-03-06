import { GraphQLSchema, GraphQLFieldConfig } from 'graphql';

import { ExecutionRequest } from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import TransformObjectFields from './TransformObjectFields';

export default class RenameObjectFields implements Transform {
  private readonly transformer: TransformObjectFields;

  constructor(renamer: (typeName: string, fieldName: string, fieldConfig: GraphQLFieldConfig<any, any>) => string) {
    this.transformer = new TransformObjectFields(
      (typeName: string, fieldName: string, fieldConfig: GraphQLFieldConfig<any, any>) => [
        renamer(typeName, fieldName, fieldConfig),
        fieldConfig,
      ]
    );
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    return this.transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }

  public transformRequest(
    originalRequest: ExecutionRequest,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): ExecutionRequest {
    return this.transformer.transformRequest(originalRequest, delegationContext, transformationContext);
  }
}
