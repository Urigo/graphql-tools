import { GraphQLInputType, getNullableType, isLeafType, isListType, isInputObjectType } from 'graphql';

import { InputLeafValueTransformer, InputObjectValueTransformer, Maybe } from './types';

export function transformInputValue(
  type: GraphQLInputType,
  value: any,
  inputLeafValueTransformer: Maybe<InputLeafValueTransformer> = null,
  inputObjectValueTransformer: Maybe<InputObjectValueTransformer> = null
): any {
  if (value == null) {
    return value;
  }

  const nullableType = getNullableType(type);

  if (isLeafType(nullableType)) {
    return inputLeafValueTransformer != null ? inputLeafValueTransformer(nullableType, value) : value;
  } else if (isListType(nullableType)) {
    return value.map((listMember: any) =>
      transformInputValue(nullableType.ofType, listMember, inputLeafValueTransformer, inputObjectValueTransformer)
    );
  } else if (isInputObjectType(nullableType)) {
    const fields = nullableType.getFields();
    const newValue = {};
    Object.keys(value).forEach(key => {
      const field = fields[key];
      if (field != null) {
        newValue[key] = transformInputValue(
          field.type,
          value[key],
          inputLeafValueTransformer,
          inputObjectValueTransformer
        );
      }
    });
    return inputObjectValueTransformer != null ? inputObjectValueTransformer(nullableType, newValue) : newValue;
  }

  // unreachable, no other possible return value
}

export function serializeInputValue(type: GraphQLInputType, value: any) {
  return transformInputValue(type, value, (t, v) => t.serialize(v));
}

export function parseInputValue(type: GraphQLInputType, value: any) {
  return transformInputValue(type, value, (t, v) => t.parseValue(v));
}

export function parseInputValueLiteral(type: GraphQLInputType, value: any) {
  return transformInputValue(type, value, (t, v) => t.parseLiteral(v, {}));
}
