import { GraphQLSchema, GraphQLFieldConfig } from 'graphql';

import { ObjectFieldFilter } from '@graphql-tools/utils';

import { SubschemaConfig, Transform } from '@graphql-tools/delegate';

import TransformObjectFields from './TransformObjectFields';

export default class FilterObjectFields implements Transform {
  private readonly transformer: TransformObjectFields;

  constructor(filter: ObjectFieldFilter) {
    this.transformer = new TransformObjectFields(
      (typeName: string, fieldName: string, fieldConfig: GraphQLFieldConfig<any, any>) =>
        filter(typeName, fieldName, fieldConfig) ? undefined : null
    );
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    return this.transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }
}
