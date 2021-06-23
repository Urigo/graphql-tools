import { GraphQLSchema } from 'graphql';

import { valueMatchesCriteria } from '@graphql-tools/utils';

import { SubschemaConfig, Transform } from '@graphql-tools/delegate';

import FilterObjectFields from './FilterObjectFields';

export default class RemoveObjectFieldsWithDeprecation implements Transform {
  private readonly transformer: FilterObjectFields;

  constructor(reason: string | RegExp) {
    this.transformer = new FilterObjectFields((_typeName, _fieldName, fieldConfig) => {
      if (fieldConfig.deprecationReason) {
        return !valueMatchesCriteria(fieldConfig.deprecationReason, reason);
      }
      return true;
    });
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    return this.transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }
}
