import { GraphQLSchema } from 'graphql';

import { getDirectives, valueMatchesCriteria } from '@graphql-tools/utils';

import { SubschemaConfig, Transform } from '@graphql-tools/delegate';

import FilterObjectFields from './FilterObjectFields';

export default class RemoveObjectFieldsWithDirective implements Transform {
  private readonly directiveName: string | RegExp;
  private readonly args: Record<string, any>;

  constructor(directiveName: string | RegExp, args: Record<string, any> = {}) {
    this.directiveName = directiveName;
    this.args = args;
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    const transformer = new FilterObjectFields((_typeName, _fieldName, fieldConfig) => {
      const valueMap = getDirectives(originalWrappingSchema, fieldConfig);
      return !Object.keys(valueMap).some(
        directiveName =>
          valueMatchesCriteria(directiveName, this.directiveName) &&
          ((Array.isArray(valueMap[directiveName]) &&
            valueMap[directiveName].some((value: any) => valueMatchesCriteria(value, this.args))) ||
            valueMatchesCriteria(valueMap[directiveName], this.args))
      );
    });

    return transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }
}
