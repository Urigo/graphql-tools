import { getNamedType, GraphQLSchema, isObjectType } from 'graphql';

import { IFieldIteratorFn } from './Interfaces';

export function forEachField(schema: GraphQLSchema, fn: IFieldIteratorFn): void {
  const typeMap = schema.getTypeMap();
  for (const typeName in typeMap) {
    const type = typeMap[typeName];

    // TODO: maybe have an option to include these?
    if (!getNamedType(type).name.startsWith('__') && isObjectType(type)) {
      const fields = type.getFields();
      for (const fieldName in fields) {
        const field = fields[fieldName];
        fn(field, typeName, fieldName);
      }
    }
  }
}
