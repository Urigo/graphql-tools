import { GraphQLSchema } from 'graphql';

import { Request, FieldNodeMappers, ExecutionResult, assertSome } from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import { ObjectValueTransformerMap, ErrorsTransformer } from '../types';

import TransformCompositeFields from './TransformCompositeFields';

export default class MapFields<TContext> implements Transform<any, TContext> {
  private fieldNodeTransformerMap: FieldNodeMappers;
  private objectValueTransformerMap?: ObjectValueTransformerMap;
  private errorsTransformer?: ErrorsTransformer;
  private transformer: TransformCompositeFields<TContext> | undefined;

  constructor(
    fieldNodeTransformerMap: FieldNodeMappers,
    objectValueTransformerMap?: ObjectValueTransformerMap,
    errorsTransformer?: ErrorsTransformer
  ) {
    this.fieldNodeTransformerMap = fieldNodeTransformerMap;
    this.objectValueTransformerMap = objectValueTransformerMap;
    this.errorsTransformer = errorsTransformer;
  }

  private _getTransformer() {
    assertSome(this.transformer);
    return this.transformer;
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig<any, any, any, TContext>,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    const subscriptionTypeName = originalWrappingSchema.getSubscriptionType()?.name;
    const objectValueTransformerMap = this.objectValueTransformerMap;
    this.transformer = new TransformCompositeFields(
      () => undefined,
      (typeName, fieldName, fieldNode, fragments, transformationContext) => {
        const typeTransformers = this.fieldNodeTransformerMap[typeName];
        if (typeTransformers == null) {
          return undefined;
        }

        const fieldNodeTransformer = typeTransformers[fieldName];
        if (fieldNodeTransformer == null) {
          return undefined;
        }

        return fieldNodeTransformer(fieldNode, fragments, transformationContext);
      },
      objectValueTransformerMap != null
        ? (data, transformationContext) => {
            if (data == null) {
              return data;
            }

            let typeName = data.__typename;
            if (typeName == null) {
              // see https://github.com/ardatan/graphql-tools/issues/2282
              typeName = subscriptionTypeName;
              if (typeName == null) {
                return data;
              }
            }

            const transformer = objectValueTransformerMap[typeName];
            if (transformer == null) {
              return data;
            }

            return transformer(data, transformationContext);
          }
        : undefined,
      this.errorsTransformer != null ? this.errorsTransformer : undefined
    );
    return this.transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): Request {
    return this._getTransformer().transformRequest(originalRequest, delegationContext, transformationContext);
  }

  public transformResult(
    originalResult: ExecutionResult,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): ExecutionResult {
    return this._getTransformer().transformResult(originalResult, delegationContext, transformationContext);
  }
}
