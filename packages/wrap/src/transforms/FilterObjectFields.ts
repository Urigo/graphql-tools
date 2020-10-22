import { GraphQLSchema, GraphQLFieldConfig } from 'graphql';

import { FieldFilter } from '@graphql-tools/utils';

import { SubschemaConfig, Transform } from '@graphql-tools/delegate';

import TransformObjectFields from './TransformObjectFields';

export default class FilterObjectFields implements Transform {
  private readonly transformer: TransformObjectFields;

  constructor(filter: FieldFilter) {
    this.transformer = new TransformObjectFields(
      (typeName: string, fieldName: string, fieldConfig: GraphQLFieldConfig<any, any>) =>
        filter(typeName, fieldName, fieldConfig) ? undefined : null
    );
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaOrSubschemaConfig?: GraphQLSchema | SubschemaConfig,
    transforms?: Array<Transform>,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    return this.transformer.transformSchema(
      originalWrappingSchema,
      subschemaOrSubschemaConfig,
      transforms,
      transformedSchema
    );
  }
}
