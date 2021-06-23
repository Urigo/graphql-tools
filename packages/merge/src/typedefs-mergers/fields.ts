import { Config } from './merge-typedefs';
import { FieldDefinitionNode, InputValueDefinitionNode, TypeNode, NameNode } from 'graphql';
import { extractType, isWrappingTypeNode, isListTypeNode, isNonNullTypeNode, printTypeNode } from './utils';
import { mergeDirectives } from './directives';
import { isNotEqual, compareNodes } from '@graphql-tools/utils';
import { mergeArguments } from './arguments';

function fieldAlreadyExists(fieldsArr: ReadonlyArray<any>, otherField: any, config?: Config): boolean {
  const result: FieldDefinitionNode | null = fieldsArr.find(field => field.name.value === otherField.name.value);

  if (result && !config?.ignoreFieldConflicts) {
    const t1 = extractType(result.type);
    const t2 = extractType(otherField.type);

    if (t1.name.value !== t2.name.value) {
      throw new Error(
        `Field "${otherField.name.value}" already defined with a different type. Declared as "${t1.name.value}", but you tried to override with "${t2.name.value}"`
      );
    }
  }

  return !!result;
}

export function mergeFields<T extends FieldDefinitionNode | InputValueDefinitionNode>(
  type: { name: NameNode },
  f1: ReadonlyArray<T> | undefined,
  f2: ReadonlyArray<T> | undefined,
  config?: Config
): T[] {
  const result: T[] = [];
  if (f2 != null) {
    result.push(...f2);
  }
  if (f1 != null) {
    for (const field of f1) {
      if (fieldAlreadyExists(result, field, config)) {
        const existing: any = result.find((f: any) => f.name.value === (field as any).name.value);

        if (!config?.ignoreFieldConflicts) {
          if (config?.throwOnConflict) {
            preventConflicts(type, existing, field, false);
          } else {
            preventConflicts(type, existing, field, true);
          }

          if (isNonNullTypeNode(field.type) && !isNonNullTypeNode(existing.type)) {
            existing.type = field.type;
          }
        }

        existing.arguments = mergeArguments(field['arguments'] || [], existing.arguments || [], config);
        existing.directives = mergeDirectives(field.directives, existing.directives, config);
        existing.description = field.description || existing.description;
      } else {
        result.push(field);
      }
    }
  }
  if (config && config.sort) {
    result.sort(compareNodes);
  }
  if (config && config.exclusions) {
    const exclusions = config.exclusions;
    return result.filter(field => !exclusions.includes(`${type.name.value}.${field.name.value}`));
  }
  return result;
}

function preventConflicts(
  type: { name: NameNode },
  a: FieldDefinitionNode | InputValueDefinitionNode,
  b: FieldDefinitionNode | InputValueDefinitionNode,
  ignoreNullability = false
) {
  const aType = printTypeNode(a.type);
  const bType = printTypeNode(b.type);

  if (isNotEqual(aType, bType)) {
    if (safeChangeForFieldType(a.type, b.type, ignoreNullability) === false) {
      throw new Error(`Field '${type.name.value}.${a.name.value}' changed type from '${aType}' to '${bType}'`);
    }
  }
}

function safeChangeForFieldType(oldType: TypeNode, newType: TypeNode, ignoreNullability = false): boolean {
  // both are named
  if (!isWrappingTypeNode(oldType) && !isWrappingTypeNode(newType)) {
    return oldType.toString() === newType.toString();
  }

  // new is non-null
  if (isNonNullTypeNode(newType)) {
    const ofType = isNonNullTypeNode(oldType) ? oldType.type : oldType;

    return safeChangeForFieldType(ofType, newType.type);
  }

  // old is non-null
  if (isNonNullTypeNode(oldType)) {
    return safeChangeForFieldType(newType, oldType, ignoreNullability);
  }

  // old is list
  if (isListTypeNode(oldType)) {
    return (
      (isListTypeNode(newType) && safeChangeForFieldType(oldType.type, newType.type)) ||
      (isNonNullTypeNode(newType) && safeChangeForFieldType(oldType, newType['type']))
    );
  }

  return false;
}
