import {
  getNamedType,
  getNullableType,
  GraphQLNamedType,
  GraphQLSchema,
  isInterfaceType,
  isListType,
  isObjectType,
  isUnionType,
  Kind,
  parseValue,
  print,
  SelectionNode,
  SelectionSetNode,
  valueFromASTUntyped,
} from 'graphql';

import { cloneSubschemaConfig, SubschemaConfig, MergedTypeConfig, MergedFieldConfig } from '@graphql-tools/delegate';
import {
  assertSome,
  getDirectives,
  getImplementingTypes,
  MapperKind,
  mapSchema,
  mergeDeep,
  parseSelectionSet,
} from '@graphql-tools/utils';

import { MergedTypeResolverInfo, StitchingDirectivesOptions } from './types';

import { defaultStitchingDirectiveOptions } from './defaultStitchingDirectiveOptions';
import { parseMergeArgsExpr } from './parseMergeArgsExpr';
import { addProperty, getProperty, getProperties } from './properties';
import { stitchingDirectivesValidator } from './stitchingDirectivesValidator';

export function stitchingDirectivesTransformer(
  options: StitchingDirectivesOptions = {}
): (subschemaConfig: SubschemaConfig) => SubschemaConfig {
  const {
    keyDirectiveName,
    computedDirectiveName,
    mergeDirectiveName,
    canonicalDirectiveName,
    pathToDirectivesInExtensions,
  } = {
    ...defaultStitchingDirectiveOptions,
    ...options,
  };

  return (subschemaConfig: SubschemaConfig): SubschemaConfig => {
    const newSubschemaConfig = cloneSubschemaConfig(subschemaConfig);

    const selectionSetsByType: Record<string, SelectionSetNode> = Object.create(null);
    const computedFieldSelectionSets: Record<string, Record<string, SelectionSetNode>> = Object.create(null);
    const mergedTypesResolversInfo: Record<string, MergedTypeResolverInfo> = Object.create(null);
    const canonicalTypesInfo: Record<string, { canonical?: boolean; fields?: Record<string, boolean> }> =
      Object.create(null);

    const schema = subschemaConfig.schema;

    // gateway should also run validation
    stitchingDirectivesValidator(options)(schema);

    function setCanonicalDefinition(typeName: string, fieldName?: string): void {
      canonicalTypesInfo[typeName] = canonicalTypesInfo[typeName] || Object.create(null);
      if (fieldName) {
        const fields: Record<string, boolean> = canonicalTypesInfo[typeName].fields ?? Object.create(null);
        canonicalTypesInfo[typeName].fields = fields;
        fields[fieldName] = true;
      } else {
        canonicalTypesInfo[typeName].canonical = true;
      }
    }

    mapSchema(schema, {
      [MapperKind.OBJECT_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (keyDirectiveName != null && directives[keyDirectiveName] != null) {
          const keyDirective = directives[keyDirectiveName];
          const selectionSet = parseSelectionSet(keyDirective.selectionSet, { noLocation: true });
          selectionSetsByType[type.name] = selectionSet;
        }

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName]) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
      [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName, typeName) => {
        const directives = getDirectives(schema, fieldConfig, pathToDirectivesInExtensions);

        if (computedDirectiveName != null && directives[computedDirectiveName] != null) {
          const computedDirective = directives[computedDirectiveName];
          const selectionSet = parseSelectionSet(computedDirective.selectionSet, { noLocation: true });
          if (!computedFieldSelectionSets[typeName]) {
            computedFieldSelectionSets[typeName] = Object.create(null);
          }
          computedFieldSelectionSets[typeName][fieldName] = selectionSet;
        }

        if (
          mergeDirectiveName != null &&
          directives[mergeDirectiveName] != null &&
          directives[mergeDirectiveName].keyField
        ) {
          const mergeDirectiveKeyField = directives[mergeDirectiveName].keyField;
          const selectionSet = parseSelectionSet(`{ ${mergeDirectiveKeyField}}`, { noLocation: true });

          const typeNames: Array<string> = directives[mergeDirectiveName].types;

          const returnType = getNamedType(fieldConfig.type);

          forEachConcreteType(schema, returnType, directives[mergeDirectiveName]?.types, typeName => {
            if (typeNames == null || typeNames.includes(typeName)) {
              const existingSelectionSet = selectionSetsByType[typeName];
              selectionSetsByType[typeName] = existingSelectionSet
                ? mergeSelectionSets(existingSelectionSet, selectionSet)
                : selectionSet;
            }
          });
        }

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(typeName, fieldName);
        }

        return undefined;
      },
      [MapperKind.INTERFACE_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
      [MapperKind.INTERFACE_FIELD]: (fieldConfig, fieldName, typeName) => {
        const directives = getDirectives(schema, fieldConfig, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName]) {
          setCanonicalDefinition(typeName, fieldName);
        }

        return undefined;
      },
      [MapperKind.INPUT_OBJECT_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
      [MapperKind.INPUT_OBJECT_FIELD]: (inputFieldConfig, fieldName, typeName) => {
        const directives = getDirectives(schema, inputFieldConfig, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(typeName, fieldName);
        }

        return undefined;
      },
      [MapperKind.UNION_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
      [MapperKind.ENUM_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
      [MapperKind.SCALAR_TYPE]: type => {
        const directives = getDirectives(schema, type, pathToDirectivesInExtensions);

        if (canonicalDirectiveName != null && directives[canonicalDirectiveName] != null) {
          setCanonicalDefinition(type.name);
        }

        return undefined;
      },
    });

    if (subschemaConfig.merge) {
      Object.entries(subschemaConfig.merge).forEach(([typeName, mergedTypeConfig]) => {
        if (mergedTypeConfig.selectionSet) {
          const selectionSet = parseSelectionSet(mergedTypeConfig.selectionSet, { noLocation: true });
          if (selectionSet) {
            if (selectionSetsByType[typeName]) {
              selectionSetsByType[typeName] = mergeSelectionSets(selectionSetsByType[typeName], selectionSet);
            } else {
              selectionSetsByType[typeName] = selectionSet;
            }
          }
        }
        if (mergedTypeConfig.fields) {
          Object.entries(mergedTypeConfig.fields).forEach(([fieldName, fieldConfig]) => {
            if (!fieldConfig.selectionSet) return;

            const selectionSet = parseSelectionSet(fieldConfig.selectionSet, { noLocation: true });
            if (selectionSet) {
              if (computedFieldSelectionSets[typeName]?.[fieldName]) {
                computedFieldSelectionSets[typeName][fieldName] = mergeSelectionSets(
                  computedFieldSelectionSets[typeName][fieldName],
                  selectionSet
                );
              } else {
                if (computedFieldSelectionSets[typeName] == null) {
                  computedFieldSelectionSets[typeName] = Object.create(null);
                }
                computedFieldSelectionSets[typeName][fieldName] = selectionSet;
              }
            }
          });
        }
      });
    }

    const allSelectionSetsByType: Record<string, Array<SelectionSetNode>> = Object.create(null);

    Object.entries(selectionSetsByType).forEach(([typeName, selectionSet]) => {
      if (allSelectionSetsByType[typeName] == null) {
        allSelectionSetsByType[typeName] = [selectionSet];
      } else {
        allSelectionSetsByType[typeName].push(selectionSet);
      }
    });

    Object.entries(computedFieldSelectionSets).forEach(([typeName, selectionSets]) => {
      Object.values(selectionSets).forEach(selectionSet => {
        if (allSelectionSetsByType[typeName] == null) {
          allSelectionSetsByType[typeName] = [selectionSet];
        } else {
          allSelectionSetsByType[typeName].push(selectionSet);
        }
      });
    });

    mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig, fieldName) => {
        const directives = getDirectives(schema, fieldConfig, pathToDirectivesInExtensions);

        if (mergeDirectiveName != null && directives[mergeDirectiveName] != null) {
          const directiveArgumentMap = directives[mergeDirectiveName];

          const returnType = getNullableType(fieldConfig.type);
          const returnsList = isListType(returnType);
          const namedType = getNamedType(returnType);

          let mergeArgsExpr: string = directiveArgumentMap.argsExpr;

          if (mergeArgsExpr == null) {
            const key: Array<string> = directiveArgumentMap.key;
            const keyField: string = directiveArgumentMap.keyField;
            const keyExpr = key != null ? buildKeyExpr(key) : keyField != null ? `$key.${keyField}` : '$key';

            const keyArg: string = directiveArgumentMap.keyArg;
            const argNames = keyArg == null ? [Object.keys(fieldConfig.args ?? {})[0]] : keyArg.split('.');

            const lastArgName = argNames.pop();
            mergeArgsExpr = returnsList ? `${lastArgName}: [[${keyExpr}]]` : `${lastArgName}: ${keyExpr}`;

            argNames.reverse().forEach(argName => {
              mergeArgsExpr = `${argName}: { ${mergeArgsExpr} }`;
            });
          }

          const typeNames: Array<string> = directiveArgumentMap.types;

          forEachConcreteTypeName(namedType, schema, typeNames, typeName => {
            const parsedMergeArgsExpr = parseMergeArgsExpr(
              mergeArgsExpr,
              allSelectionSetsByType[typeName] == null
                ? undefined
                : mergeSelectionSets(...allSelectionSetsByType[typeName])
            );

            const additionalArgs = directiveArgumentMap.additionalArgs;
            if (additionalArgs != null) {
              parsedMergeArgsExpr.args = mergeDeep(
                parsedMergeArgsExpr.args,
                valueFromASTUntyped(parseValue(`{ ${additionalArgs} }`, { noLocation: true }))
              );
            }

            mergedTypesResolversInfo[typeName] = {
              fieldName,
              returnsList,
              ...parsedMergeArgsExpr,
            };
          });
        }

        return undefined;
      },
    });

    Object.entries(selectionSetsByType).forEach(([typeName, selectionSet]) => {
      const mergeConfig: Record<string, MergedTypeConfig<any, any, any>> = newSubschemaConfig.merge ??
      Object.create(null);
      newSubschemaConfig.merge = mergeConfig;

      if (mergeConfig[typeName] == null) {
        newSubschemaConfig.merge[typeName] = Object.create(null);
      }

      const mergeTypeConfig = mergeConfig[typeName];

      mergeTypeConfig.selectionSet = print(selectionSet);
    });

    Object.entries(computedFieldSelectionSets).forEach(([typeName, selectionSets]) => {
      const mergeConfig: Record<string, MergedTypeConfig<any, any, any>> = newSubschemaConfig.merge ??
      Object.create(null);
      newSubschemaConfig.merge = mergeConfig;

      if (mergeConfig[typeName] == null) {
        mergeConfig[typeName] = Object.create(null);
      }

      const mergeTypeConfig = newSubschemaConfig.merge[typeName];
      const mergeTypeConfigFields: Record<string, MergedFieldConfig> = mergeTypeConfig.fields ?? Object.create(null);
      mergeTypeConfig.fields = mergeTypeConfigFields;

      Object.entries(selectionSets).forEach(([fieldName, selectionSet]) => {
        const fieldConfig: MergedFieldConfig = mergeTypeConfigFields[fieldName] ?? Object.create(null);
        mergeTypeConfigFields[fieldName] = fieldConfig;

        fieldConfig.selectionSet = print(selectionSet);
        fieldConfig.computed = true;
      });
    });

    Object.entries(mergedTypesResolversInfo).forEach(([typeName, mergedTypeResolverInfo]) => {
      const mergeConfig: Record<string, MergedTypeConfig<any, any, any>> = newSubschemaConfig.merge ??
      Object.create(null);
      newSubschemaConfig.merge = mergeConfig;

      if (newSubschemaConfig.merge[typeName] == null) {
        newSubschemaConfig.merge[typeName] = Object.create(null);
      }

      const mergeTypeConfig = newSubschemaConfig.merge[typeName];

      mergeTypeConfig.fieldName = mergedTypeResolverInfo.fieldName;

      if (mergedTypeResolverInfo.returnsList) {
        mergeTypeConfig.key = generateKeyFn(mergedTypeResolverInfo);
        mergeTypeConfig.argsFromKeys = generateArgsFromKeysFn(mergedTypeResolverInfo);
      } else {
        mergeTypeConfig.args = generateArgsFn(mergedTypeResolverInfo);
      }
    });

    Object.entries(canonicalTypesInfo).forEach(([typeName, canonicalTypeInfo]) => {
      const mergeConfig: Record<string, MergedTypeConfig<any, any, any>> = newSubschemaConfig.merge ??
      Object.create(null);
      newSubschemaConfig.merge = mergeConfig;

      if (newSubschemaConfig.merge[typeName] == null) {
        newSubschemaConfig.merge[typeName] = Object.create(null);
      }

      const mergeTypeConfig = newSubschemaConfig.merge[typeName];

      if (canonicalTypeInfo.canonical) {
        mergeTypeConfig.canonical = true;
      }

      if (canonicalTypeInfo.fields) {
        const mergeTypeConfigFields: Record<string, MergedFieldConfig> = mergeTypeConfig.fields ?? Object.create(null);
        mergeTypeConfig.fields = mergeTypeConfigFields;
        Object.keys(canonicalTypeInfo.fields).forEach(fieldName => {
          if (mergeTypeConfigFields[fieldName] == null) {
            mergeTypeConfigFields[fieldName] = Object.create(null);
          }
          mergeTypeConfigFields[fieldName].canonical = true;
        });
      }
    });

    return newSubschemaConfig;
  };
}

function forEachConcreteType(
  schema: GraphQLSchema,
  type: GraphQLNamedType,
  typeNames: Array<string>,
  fn: (typeName: string) => void
) {
  if (isInterfaceType(type)) {
    getImplementingTypes(type.name, schema).forEach(typeName => {
      if (typeNames == null || typeNames.includes(typeName)) {
        fn(typeName);
      }
    });
  } else if (isUnionType(type)) {
    type.getTypes().forEach(({ name: typeName }) => {
      if (typeNames == null || typeNames.includes(typeName)) {
        fn(typeName);
      }
    });
  } else if (isObjectType(type)) {
    fn(type.name);
  }
}

function generateKeyFn(mergedTypeResolverInfo: MergedTypeResolverInfo): (originalResult: any) => any {
  return (originalResult: any): any => getProperties(originalResult, mergedTypeResolverInfo.usedProperties);
}

function generateArgsFromKeysFn(
  mergedTypeResolverInfo: MergedTypeResolverInfo
): (keys: ReadonlyArray<any>) => Record<string, any> {
  const { expansions, args } = mergedTypeResolverInfo;
  return (keys: ReadonlyArray<any>): Record<string, any> => {
    const newArgs = mergeDeep({}, args);
    expansions?.forEach(expansion => {
      const mappingInstructions = expansion.mappingInstructions;
      const expanded: Array<any> = [];
      keys.forEach(key => {
        let newValue = mergeDeep({}, expansion.valuePath);
        mappingInstructions.forEach(mappingInstruction => {
          const { destinationPath, sourcePath } = mappingInstruction;
          if (destinationPath.length) {
            addProperty(newValue, destinationPath, getProperty(key, sourcePath));
          } else {
            newValue = getProperty(key, sourcePath);
          }
        });
        expanded.push(newValue);
      });
      addProperty(newArgs, expansion.valuePath, expanded);
    });
    return newArgs;
  };
}

function generateArgsFn(mergedTypeResolverInfo: MergedTypeResolverInfo): (originalResult: any) => Record<string, any> {
  const { mappingInstructions, args, usedProperties } = mergedTypeResolverInfo;

  return (originalResult: any): Record<string, any> => {
    const newArgs = mergeDeep({}, args);
    const filteredResult = getProperties(originalResult, usedProperties);
    mappingInstructions?.forEach(mappingInstruction => {
      const { destinationPath, sourcePath } = mappingInstruction;
      addProperty(newArgs, destinationPath, getProperty(filteredResult, sourcePath));
    });
    return newArgs;
  };
}

function buildKeyExpr(key: Array<string>): string {
  let mergedObject = {};
  key.forEach(keyDef => {
    let [aliasOrKeyPath, keyPath] = keyDef.split(':');
    let aliasPath: string;
    if (keyPath == null) {
      keyPath = aliasPath = aliasOrKeyPath;
    } else {
      aliasPath = aliasOrKeyPath;
    }
    const aliasParts = aliasPath.split('.');
    const lastAliasPart = aliasParts.pop();
    assertSome(lastAliasPart);
    let object: Record<string, unknown> = { [lastAliasPart]: `$key.${keyPath}` };

    aliasParts.reverse().forEach(aliasPart => {
      object = { [aliasPart]: object };
    });
    mergedObject = mergeDeep(mergedObject, object);
  });

  return JSON.stringify(mergedObject).replace(/"/g, '');
}

function mergeSelectionSets(...selectionSets: Array<SelectionSetNode>): SelectionSetNode {
  const normalizedSelections: Record<string, SelectionNode> = Object.create(null);

  selectionSets.forEach(selectionSet => {
    selectionSet.selections.forEach(selection => {
      const normalizedSelection = print(selection);
      normalizedSelections[normalizedSelection] = selection;
    });
  });

  const newSelectionSet = {
    kind: Kind.SELECTION_SET,
    selections: Object.values(normalizedSelections),
  };

  return newSelectionSet;
}

function forEachConcreteTypeName(
  returnType: GraphQLNamedType,
  schema: GraphQLSchema,
  typeNames: Array<string>,
  fn: (typeName: string) => void
): void {
  if (isInterfaceType(returnType)) {
    getImplementingTypes(returnType.name, schema).forEach(typeName => {
      if (typeNames == null || typeNames.includes(typeName)) {
        fn(typeName);
      }
    });
  } else if (isUnionType(returnType)) {
    returnType.getTypes().forEach(type => {
      if (typeNames == null || typeNames.includes(type.name)) {
        fn(type.name);
      }
    });
  } else if (isObjectType(returnType) && (typeNames == null || typeNames.includes(returnType.name))) {
    fn(returnType.name);
  }
}
