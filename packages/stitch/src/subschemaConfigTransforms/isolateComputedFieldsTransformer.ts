import { GraphQLObjectType, isObjectType, isInterfaceType } from 'graphql';

import { SubschemaConfig, MergedTypeConfig, MergedFieldConfig } from '@graphql-tools/delegate';

import { getImplementingTypes, pruneSchema, filterSchema } from '@graphql-tools/utils';

import { TransformCompositeFields } from '@graphql-tools/wrap';

export function isolateComputedFieldsTransformer(subschemaConfig: SubschemaConfig): Array<SubschemaConfig> {
  if (subschemaConfig.merge == null) {
    return [subschemaConfig];
  }

  const baseSchemaTypes: Record<string, MergedTypeConfig> = Object.create(null);
  const isolatedSchemaTypes: Record<string, MergedTypeConfig> = Object.create(null);

  for (const typeName in subschemaConfig.merge) {
    const mergedTypeConfig = subschemaConfig.merge[typeName];

    baseSchemaTypes[typeName] = mergedTypeConfig;

    if (mergedTypeConfig.computedFields) {
      const mergeConfigFields = mergedTypeConfig.fields ?? Object.create(null);
      for (const fieldName in mergedTypeConfig.computedFields) {
        const mergedFieldConfig = mergedTypeConfig.computedFields[fieldName];
        console.warn(
          `The "computedFields" setting is deprecated. Update your @graphql-tools/stitching-directives package, and/or update static merged type config to "${typeName}.fields.${fieldName} = { selectionSet: '${mergedFieldConfig.selectionSet}', computed: true }"`
        );
        mergeConfigFields[fieldName] = {
          ...(mergeConfigFields[fieldName] ?? {}),
          ...mergedFieldConfig,
          computed: true,
        };
      }
      delete mergedTypeConfig.computedFields;
      mergedTypeConfig.fields = mergeConfigFields;
    }

    if (mergedTypeConfig.fields) {
      const baseFields: Record<string, MergedFieldConfig> = Object.create(null);
      const isolatedFields: Record<string, MergedFieldConfig> = Object.create(null);

      for (const fieldName in mergedTypeConfig.fields) {
        const mergedFieldConfig = mergedTypeConfig.fields[fieldName];
        if (mergedFieldConfig.computed && mergedFieldConfig.selectionSet) {
          isolatedFields[fieldName] = mergedFieldConfig;
        } else if (mergedFieldConfig.computed) {
          throw new Error(`A selectionSet is required for computed field "${typeName}.${fieldName}"`);
        } else {
          baseFields[fieldName] = mergedFieldConfig;
        }
      }

      const isolatedFieldCount = Object.keys(isolatedFields).length;
      const objectType = subschemaConfig.schema.getType(typeName) as GraphQLObjectType;

      if (isolatedFieldCount && isolatedFieldCount !== Object.keys(objectType.getFields()).length) {
        baseSchemaTypes[typeName] = {
          ...mergedTypeConfig,
          fields: baseFields,
        };
        isolatedSchemaTypes[typeName] = {
          ...mergedTypeConfig,
          fields: isolatedFields,
          canonical: undefined,
        };
      }
    }
  }

  if (Object.keys(isolatedSchemaTypes).length) {
    return [
      filterBaseSubschema({ ...subschemaConfig, merge: baseSchemaTypes }, isolatedSchemaTypes),
      filterIsolatedSubschema({ ...subschemaConfig, merge: isolatedSchemaTypes }),
    ];
  }

  return [subschemaConfig];
}

function filterBaseSubschema(
  subschemaConfig: SubschemaConfig,
  isolatedSchemaTypes: Record<string, MergedTypeConfig>
): SubschemaConfig {
  const schema = subschemaConfig.schema;
  const typesForInterface: Record<string, string[]> = {};
  const filteredSchema = pruneSchema(
    filterSchema({
      schema,
      objectFieldFilter: (typeName, fieldName) => !isolatedSchemaTypes[typeName]?.fields?.[fieldName],
      interfaceFieldFilter: (typeName, fieldName) => {
        if (!typesForInterface[typeName]) {
          typesForInterface[typeName] = getImplementingTypes(typeName, schema);
        }
        return !typesForInterface[typeName].some(
          implementingTypeName => isolatedSchemaTypes[implementingTypeName]?.fields?.[fieldName]
        );
      },
    })
  );

  const filteredFields: Record<string, Record<string, boolean>> = {};
  for (const typeName in filteredSchema.getTypeMap()) {
    const type = filteredSchema.getType(typeName);
    if (isObjectType(type) || isInterfaceType(type)) {
      filteredFields[typeName] = { __typename: true };
      const fieldMap = type.getFields();
      for (const fieldName in fieldMap) {
        filteredFields[typeName][fieldName] = true;
      }
    }
  }

  const filteredSubschema = {
    ...subschemaConfig,
    merge: subschemaConfig.merge
      ? {
          ...subschemaConfig.merge,
        }
      : undefined,
    transforms: (subschemaConfig.transforms ?? []).concat([
      new TransformCompositeFields(
        (typeName, fieldName) => (filteredFields[typeName]?.[fieldName] ? undefined : null),
        (typeName, fieldName) => (filteredFields[typeName]?.[fieldName] ? undefined : null)
      ),
    ]),
  };

  const remainingTypes = filteredSchema.getTypeMap();
  const mergeConfig = filteredSubschema.merge;
  if (mergeConfig) {
    for (const mergeType in mergeConfig) {
      if (!remainingTypes[mergeType]) {
        delete mergeConfig[mergeType];
      }
    }

    if (!Object.keys(mergeConfig).length) {
      delete filteredSubschema.merge;
    }
  }

  return filteredSubschema;
}

type IsolatedSubschemaInput = Exclude<SubschemaConfig, 'merge'> & {
  merge: Exclude<SubschemaConfig['merge'], null | undefined>;
};

function filterIsolatedSubschema(subschemaConfig: IsolatedSubschemaInput): SubschemaConfig {
  const rootFields: Record<string, boolean> = {};

  for (const typeName in subschemaConfig.merge) {
    const mergedTypeConfig = subschemaConfig.merge[typeName];
    const entryPoints = mergedTypeConfig.entryPoints ?? [mergedTypeConfig];
    for (const entryPoint of entryPoints) {
      if (entryPoint.fieldName != null) {
        rootFields[entryPoint.fieldName] = true;
      }
    }
  }

  const interfaceFields: Record<string, Record<string, boolean>> = {};
  for (const typeName in subschemaConfig.merge) {
    const type = subschemaConfig.schema.getType(typeName);
    if (!type || !('getInterfaces' in type)) {
      throw new Error(`${typeName} expected to have 'getInterfaces' method`);
    }
    for (const int of type.getInterfaces()) {
      const intType = subschemaConfig.schema.getType(int.name);
      if (!intType || !('getFields' in intType)) {
        throw new Error(`${int.name} expected to have 'getFields' method`);
      }
      for (const intFieldName in intType.getFields()) {
        if (subschemaConfig.merge[typeName].fields?.[intFieldName]) {
          interfaceFields[int.name] = interfaceFields[int.name] || {};
          interfaceFields[int.name][intFieldName] = true;
        }
      }
    }
  }

  const filteredSchema = pruneSchema(
    filterSchema({
      schema: subschemaConfig.schema,
      rootFieldFilter: (operation, fieldName) => operation === 'Query' && rootFields[fieldName] != null,
      objectFieldFilter: (typeName, fieldName) => subschemaConfig.merge[typeName]?.fields?.[fieldName] != null,
      interfaceFieldFilter: (typeName, fieldName) => interfaceFields[typeName]?.[fieldName] != null,
    })
  );

  const filteredFields: Record<string, Record<string, boolean>> = {};
  for (const typeName in filteredSchema.getTypeMap()) {
    const type = filteredSchema.getType(typeName);
    if (isObjectType(type) || isInterfaceType(type)) {
      filteredFields[typeName] = { __typename: true };
      const fieldMap = type.getFields();
      for (const fieldName in fieldMap) {
        filteredFields[typeName][fieldName] = true;
      }
    }
  }

  return {
    ...subschemaConfig,
    transforms: (subschemaConfig.transforms ?? []).concat([
      new TransformCompositeFields(
        (typeName, fieldName) => (filteredFields[typeName]?.[fieldName] ? undefined : null),
        (typeName, fieldName) => (filteredFields[typeName]?.[fieldName] ? undefined : null)
      ),
    ]),
  };
}
