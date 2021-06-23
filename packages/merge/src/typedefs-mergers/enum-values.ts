import { EnumValueDefinitionNode } from 'graphql';
import { mergeDirectives } from './directives';
import { Config } from './merge-typedefs';
import { compareNodes } from '@graphql-tools/utils';

export function mergeEnumValues(
  first: ReadonlyArray<EnumValueDefinitionNode> | undefined,
  second: ReadonlyArray<EnumValueDefinitionNode> | undefined,
  config?: Config
): EnumValueDefinitionNode[] {
  if (config?.consistentEnumMerge) {
    const reversed: Array<EnumValueDefinitionNode> = [];
    if (first) {
      reversed.push(...first);
    }
    first = second;
    second = reversed;
  }
  const enumValueMap = new Map<string, EnumValueDefinitionNode>();
  if (first) {
    for (const firstValue of first) {
      enumValueMap.set(firstValue.name.value, firstValue);
    }
  }
  if (second) {
    for (const secondValue of second) {
      const enumValue = secondValue.name.value;
      if (enumValueMap.has(enumValue)) {
        const firstValue: any = enumValueMap.get(enumValue);
        firstValue.description = secondValue.description || firstValue.description;
        firstValue.directives = mergeDirectives(secondValue.directives, firstValue.directives);
      } else {
        enumValueMap.set(enumValue, secondValue);
      }
    }
  }

  const result = [...enumValueMap.values()];
  if (config && config.sort) {
    result.sort(compareNodes);
  }
  return result;
}
