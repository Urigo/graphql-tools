import { cloneSubschemaConfig, MergedTypeConfig, SubschemaConfig } from '@graphql-tools/delegate';

export function splitMergedTypeEntryPointsTransformer(subschemaConfig: SubschemaConfig): Array<SubschemaConfig> {
  if (!subschemaConfig.merge) return [subschemaConfig];

  const maxEntryPoints = Object.values(subschemaConfig.merge).reduce((max: number, mergedTypeConfig) => {
    return Math.max(max, mergedTypeConfig?.entryPoints?.length ?? 0);
  }, 0);

  if (maxEntryPoints === 0) return [subschemaConfig];

  const subschemaPermutations = [];

  for (let i = 0; i < maxEntryPoints; i += 1) {
    const subschemaPermutation = cloneSubschemaConfig(subschemaConfig);
    const mergedTypesCopy: Record<string, MergedTypeConfig<any, any, any>> = subschemaPermutation.merge ??
    Object.create(null);
    let currentMerge = mergedTypesCopy;

    if (i > 0) {
      subschemaPermutation.merge = currentMerge = Object.create(null);
    }

    for (const typeName in mergedTypesCopy) {
      const mergedTypeConfig = mergedTypesCopy[typeName];
      const mergedTypeEntryPoint = mergedTypeConfig?.entryPoints?.[i];

      if (mergedTypeEntryPoint) {
        if (mergedTypeConfig.selectionSet ?? mergedTypeConfig.fieldName ?? mergedTypeConfig.resolve) {
          throw new Error(
            `Merged type ${typeName} may not define entryPoints in addition to selectionSet, fieldName, or resolve`
          );
        }

        Object.assign(mergedTypeConfig, mergedTypeEntryPoint);
        delete mergedTypeConfig.entryPoints;

        if (i > 0) {
          delete mergedTypeConfig.canonical;
          if (mergedTypeConfig.fields != null) {
            for (const mergedFieldName in mergedTypeConfig.fields) {
              const mergedFieldConfig = mergedTypeConfig.fields[mergedFieldName];
              delete mergedFieldConfig.canonical;
            }
          }
        }

        currentMerge[typeName] = mergedTypeConfig;
      }
    }

    subschemaPermutations.push(subschemaPermutation);
  }

  return subschemaPermutations;
}
