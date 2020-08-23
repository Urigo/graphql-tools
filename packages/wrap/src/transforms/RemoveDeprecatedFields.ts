import { GraphQLSchema, GraphQLFieldConfig } from 'graphql';
import { Transform } from '@graphql-tools/utils';
import { FilterObjectFields } from '@graphql-tools/wrap';

export default class RemoveDeprecatedFields implements Transform {
  private readonly transformer: FilterObjectFields;

  constructor(reason: string | RegExp) {
    this.transformer = new FilterObjectFields(
      (_typeName: string, _fieldName: string, fieldConfig: GraphQLFieldConfig<any, any>) => {
        if (fieldConfig.deprecationReason) {
          return !(
            (reason instanceof RegExp && reason.test(fieldConfig.deprecationReason)) ||
            reason === fieldConfig.deprecationReason
          );
        }
        return true;
      }
    );
  }

  public transformSchema(originalSchema: GraphQLSchema): GraphQLSchema {
    return this.transformer.transformSchema(originalSchema);
  }
}
