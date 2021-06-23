import {
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  isScalarType,
  isObjectType,
  isInterfaceType,
  isUnionType,
  isEnumType,
  isInputObjectType,
  GraphQLFieldConfig,
  GraphQLFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInputFieldConfig,
  GraphQLInputFieldConfigMap,
  ObjectTypeDefinitionNode,
  InputObjectTypeDefinitionNode,
  InterfaceTypeDefinitionNode,
  UnionTypeDefinitionNode,
  EnumTypeDefinitionNode,
  GraphQLEnumValueConfigMap,
  ScalarTypeDefinitionNode,
  GraphQLScalarType,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
  ObjectTypeExtensionNode,
  InputObjectTypeExtensionNode,
  InterfaceTypeExtensionNode,
  UnionTypeExtensionNode,
  EnumTypeExtensionNode,
  ScalarTypeExtensionNode,
} from 'graphql';

import { mergeType, mergeInputType, mergeInterface, mergeUnion, mergeEnum, mergeScalar } from '@graphql-tools/merge';

import {
  MergeTypeCandidate,
  TypeMergingOptions,
  MergeFieldConfigCandidate,
  MergeInputFieldConfigCandidate,
  MergeEnumValueConfigCandidate,
} from './types';

import {
  validateFieldConsistency,
  validateInputFieldConsistency,
  validateInputObjectConsistency,
} from './mergeValidations';

import { isSubschemaConfig } from '@graphql-tools/delegate';
import { Maybe } from '@graphql-tools/utils';

export function mergeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLNamedType {
  const initialCandidateType = candidates[0].type;
  if (candidates.some(candidate => candidate.type.constructor !== initialCandidateType.constructor)) {
    throw new Error(`Cannot merge different type categories into common type ${typeName}.`);
  }
  if (isObjectType(initialCandidateType)) {
    return mergeObjectTypeCandidates(typeName, candidates, typeMergingOptions);
  } else if (isInputObjectType(initialCandidateType)) {
    return mergeInputObjectTypeCandidates(typeName, candidates, typeMergingOptions);
  } else if (isInterfaceType(initialCandidateType)) {
    return mergeInterfaceTypeCandidates(typeName, candidates, typeMergingOptions);
  } else if (isUnionType(initialCandidateType)) {
    return mergeUnionTypeCandidates(typeName, candidates, typeMergingOptions);
  } else if (isEnumType(initialCandidateType)) {
    return mergeEnumTypeCandidates(typeName, candidates, typeMergingOptions);
  } else if (isScalarType(initialCandidateType)) {
    return mergeScalarTypeCandidates(typeName, candidates, typeMergingOptions);
  } else {
    // not reachable.
    throw new Error(`Type ${typeName} has unknown GraphQL type.`);
  }
}

function mergeObjectTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLObjectType<any, any> {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);

  const description = mergeTypeDescriptions(candidates, typeMergingOptions);
  const fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
  const typeConfigs = candidates.map(candidate => (candidate.type as GraphQLObjectType).toConfig());
  const interfaceMap = typeConfigs
    .map(typeConfig => typeConfig.interfaces)
    .reduce((acc, interfaces) => {
      if (interfaces != null) {
        interfaces.forEach(iface => {
          acc[iface.name] = iface;
        });
      }
      return acc;
    }, Object.create(null));
  const interfaces = Object.keys(interfaceMap).map(interfaceName => interfaceMap[interfaceName]);

  const astNodes = pluck<ObjectTypeDefinitionNode>('astNode', candidates);
  const fieldAstNodes = canonicalFieldNamesForType(candidates)
    .map(fieldName => fields[fieldName]?.astNode)
    .filter(n => n != null);

  if (astNodes.length > 1 && fieldAstNodes.length) {
    astNodes.push({
      ...astNodes[astNodes.length - 1],
      fields: JSON.parse(JSON.stringify(fieldAstNodes)),
    });
  }

  const astNode = astNodes
    .slice(1)
    .reduce(
      (acc, astNode) =>
        mergeType(astNode, acc as ObjectTypeDefinitionNode, { ignoreFieldConflicts: true }) as ObjectTypeDefinitionNode,
      astNodes[0]
    );

  const extensionASTNodes = pluck<ObjectTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    fields,
    interfaces,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLObjectType(typeConfig);
}

function mergeInputObjectTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLInputObjectType {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);

  const description = mergeTypeDescriptions(candidates, typeMergingOptions);
  const fields = inputFieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);

  const astNodes = pluck<InputObjectTypeDefinitionNode>('astNode', candidates);
  const fieldAstNodes = canonicalFieldNamesForType(candidates)
    .map(fieldName => fields[fieldName]?.astNode)
    .filter(n => n != null);

  if (astNodes.length > 1 && fieldAstNodes.length) {
    astNodes.push({
      ...astNodes[astNodes.length - 1],
      fields: JSON.parse(JSON.stringify(fieldAstNodes)),
    });
  }

  const astNode = astNodes.slice(1).reduce(
    (acc, astNode) =>
      mergeInputType(astNode, acc as InputObjectTypeDefinitionNode, {
        ignoreFieldConflicts: true,
      }) as InputObjectTypeDefinitionNode,
    astNodes[0]
  );

  const extensionASTNodes = pluck<InputObjectTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    fields,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLInputObjectType(typeConfig);
}

function pluck<T>(typeProperty: string, candidates: Array<MergeTypeCandidate<any>>): Array<T> {
  return candidates.map(candidate => candidate.type[typeProperty]).filter(value => value != null) as Array<T>;
}

function mergeInterfaceTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLInterfaceType {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);

  const description = mergeTypeDescriptions(candidates, typeMergingOptions);
  const fields = fieldConfigMapFromTypeCandidates(candidates, typeMergingOptions);
  const typeConfigs = candidates.map(candidate => (candidate.type as GraphQLInterfaceType).toConfig());
  const interfaceMap = typeConfigs
    .map(typeConfig => (typeConfig as unknown as { interfaces: Array<GraphQLInterfaceType> }).interfaces)
    .reduce((acc, interfaces) => {
      if (interfaces != null) {
        interfaces.forEach(iface => {
          acc[iface.name] = iface;
        });
      }
      return acc;
    }, Object.create(null));
  const interfaces = Object.keys(interfaceMap).map(interfaceName => interfaceMap[interfaceName]);

  const astNodes = pluck<InterfaceTypeDefinitionNode>('astNode', candidates);
  const fieldAstNodes = canonicalFieldNamesForType(candidates)
    .map(fieldName => fields[fieldName]?.astNode)
    .filter(n => n != null);

  if (astNodes.length > 1 && fieldAstNodes.length) {
    astNodes.push({
      ...astNodes[astNodes.length - 1],
      fields: JSON.parse(JSON.stringify(fieldAstNodes)),
    });
  }

  const astNode = astNodes.slice(1).reduce(
    (acc, astNode) =>
      mergeInterface(astNode, acc as InterfaceTypeDefinitionNode, {
        ignoreFieldConflicts: true,
      }) as InterfaceTypeDefinitionNode,
    astNodes[0]
  );

  const extensionASTNodes = pluck<InterfaceTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    fields,
    interfaces,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLInterfaceType(typeConfig);
}

function mergeUnionTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLUnionType {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);
  const description = mergeTypeDescriptions(candidates, typeMergingOptions);

  const typeConfigs = candidates.map(candidate => (candidate.type as GraphQLUnionType).toConfig());
  const typeMap = typeConfigs.reduce((acc, typeConfig) => {
    typeConfig.types.forEach(type => {
      acc[type.name] = type;
    });
    return acc;
  }, Object.create(null));
  const types = Object.keys(typeMap).map(typeName => typeMap[typeName]);

  const astNodes = pluck<UnionTypeDefinitionNode>('astNode', candidates);
  const astNode = astNodes
    .slice(1)
    .reduce(
      (acc, astNode) => mergeUnion(astNode, acc as UnionTypeDefinitionNode) as UnionTypeDefinitionNode,
      astNodes[0]
    );

  const extensionASTNodes = pluck<UnionTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    types,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLUnionType(typeConfig);
}

function mergeEnumTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLEnumType {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);

  const description = mergeTypeDescriptions(candidates, typeMergingOptions);
  const values = enumValueConfigMapFromTypeCandidates(candidates, typeMergingOptions);

  const astNodes = pluck<EnumTypeDefinitionNode>('astNode', candidates);
  const astNode = astNodes
    .slice(1)
    .reduce(
      (acc, astNode) =>
        mergeEnum(astNode, acc as EnumTypeDefinitionNode, { consistentEnumMerge: true }) as EnumTypeDefinitionNode,
      astNodes[0]
    );

  const extensionASTNodes = pluck<EnumTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    values,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLEnumType(typeConfig);
}

function enumValueConfigMapFromTypeCandidates(
  candidates: Array<MergeTypeCandidate<any>>,
  typeMergingOptions?: TypeMergingOptions<any>
): GraphQLEnumValueConfigMap {
  const enumValueConfigCandidatesMap: Record<string, Array<MergeEnumValueConfigCandidate>> = Object.create(null);

  candidates.forEach(candidate => {
    const valueMap = (candidate.type as GraphQLEnumType).toConfig().values;
    Object.keys(valueMap).forEach(enumValue => {
      const enumValueConfigCandidate = {
        enumValueConfig: valueMap[enumValue],
        enumValue,
        type: candidate.type as GraphQLEnumType,
        subschema: candidate.subschema,
        transformedSubschema: candidate.transformedSubschema,
      };

      if (enumValue in enumValueConfigCandidatesMap) {
        enumValueConfigCandidatesMap[enumValue].push(enumValueConfigCandidate);
      } else {
        enumValueConfigCandidatesMap[enumValue] = [enumValueConfigCandidate];
      }
    });
  });

  const enumValueConfigMap = Object.create(null);

  Object.keys(enumValueConfigCandidatesMap).forEach(enumValue => {
    const enumValueConfigMerger = typeMergingOptions?.enumValueConfigMerger ?? defaultEnumValueConfigMerger;
    enumValueConfigMap[enumValue] = enumValueConfigMerger(enumValueConfigCandidatesMap[enumValue]);
  });

  return enumValueConfigMap;
}

function defaultEnumValueConfigMerger(candidates: Array<MergeEnumValueConfigCandidate>) {
  const preferred = candidates.find(
    ({ type, transformedSubschema }) =>
      isSubschemaConfig(transformedSubschema) && transformedSubschema.merge?.[type.name]?.canonical
  );
  return (preferred || candidates[candidates.length - 1]).enumValueConfig;
}

function mergeScalarTypeCandidates<TContext = Record<string, any>>(
  typeName: string,
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLScalarType {
  candidates = orderedTypeCandidates(candidates, typeMergingOptions);

  const description = mergeTypeDescriptions(candidates, typeMergingOptions);
  const serializeFns = pluck<GraphQLScalarSerializer<any>>('serialize', candidates);
  const serialize = serializeFns[serializeFns.length - 1];

  const parseValueFns = pluck<GraphQLScalarValueParser<any>>('parseValue', candidates);
  const parseValue = parseValueFns[parseValueFns.length - 1];

  const parseLiteralFns = pluck<GraphQLScalarLiteralParser<any>>('parseLiteral', candidates);
  const parseLiteral = parseLiteralFns[parseLiteralFns.length - 1];

  const astNodes = pluck<ScalarTypeDefinitionNode>('astNode', candidates);
  const astNode = astNodes
    .slice(1)
    .reduce(
      (acc, astNode) => mergeScalar(astNode, acc as ScalarTypeDefinitionNode) as ScalarTypeDefinitionNode,
      astNodes[0]
    );

  const extensionASTNodes = pluck<ScalarTypeExtensionNode>('extensionASTNodes', candidates);

  const extensions = Object.assign({}, ...pluck<Record<string, any>>('extensions', candidates));

  const typeConfig = {
    name: typeName,
    description,
    serialize,
    parseValue,
    parseLiteral,
    astNode,
    extensionASTNodes,
    extensions,
  };

  return new GraphQLScalarType(typeConfig);
}

function orderedTypeCandidates<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): Array<MergeTypeCandidate<TContext>> {
  const typeCandidateMerger = typeMergingOptions?.typeCandidateMerger ?? defaultTypeCandidateMerger;
  const candidate = typeCandidateMerger(candidates);
  return candidates.filter(c => c !== candidate).concat([candidate]);
}

function defaultTypeCandidateMerger<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>
): MergeTypeCandidate<TContext> {
  const canonical: Array<MergeTypeCandidate<TContext>> = candidates.filter(({ type, transformedSubschema }) =>
    isSubschemaConfig(transformedSubschema) ? transformedSubschema.merge?.[type.name]?.canonical : false
  );

  if (canonical.length > 1) {
    throw new Error(`Multiple canonical definitions for "${canonical[0].type.name}"`);
  } else if (canonical.length) {
    return canonical[0];
  }

  return candidates[candidates.length - 1];
}

function mergeTypeDescriptions<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): Maybe<string> {
  const typeDescriptionsMerger = typeMergingOptions?.typeDescriptionsMerger ?? defaultTypeDescriptionMerger;
  return typeDescriptionsMerger(candidates);
}

function defaultTypeDescriptionMerger<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>
): Maybe<string> {
  return candidates[candidates.length - 1].type.description;
}

function fieldConfigMapFromTypeCandidates<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLFieldConfigMap<any, any> {
  const fieldConfigCandidatesMap: Record<string, Array<MergeFieldConfigCandidate<TContext>>> = Object.create(null);

  candidates.forEach(candidate => {
    const typeConfig = (candidate.type as GraphQLObjectType | GraphQLInterfaceType).toConfig();
    const fieldConfigMap = typeConfig.fields;
    Object.entries(fieldConfigMap).forEach(([fieldName, fieldConfig]) => {
      const fieldConfigCandidate = {
        fieldConfig,
        fieldName,
        type: candidate.type as GraphQLObjectType | GraphQLInterfaceType,
        subschema: candidate.subschema,
        transformedSubschema: candidate.transformedSubschema,
      };

      if (fieldName in fieldConfigCandidatesMap) {
        fieldConfigCandidatesMap[fieldName].push(fieldConfigCandidate);
      } else {
        fieldConfigCandidatesMap[fieldName] = [fieldConfigCandidate];
      }
    });
  });

  const fieldConfigMap = Object.create(null);

  Object.keys(fieldConfigCandidatesMap).forEach(fieldName => {
    fieldConfigMap[fieldName] = mergeFieldConfigs(fieldConfigCandidatesMap[fieldName], typeMergingOptions);
  });

  return fieldConfigMap;
}

function mergeFieldConfigs<TContext = Record<string, any>>(
  candidates: Array<MergeFieldConfigCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
) {
  const fieldConfigMerger = typeMergingOptions?.fieldConfigMerger ?? defaultFieldConfigMerger;
  const finalFieldConfig = fieldConfigMerger(candidates);
  validateFieldConsistency(finalFieldConfig, candidates, typeMergingOptions);
  return finalFieldConfig;
}

function defaultFieldConfigMerger<TContext = Record<string, any>>(
  candidates: Array<MergeFieldConfigCandidate<TContext>>
) {
  const canonicalByField: Array<GraphQLFieldConfig<any, any>> = [];
  const canonicalByType: Array<GraphQLFieldConfig<any, any>> = [];

  candidates.forEach(({ type, fieldName, fieldConfig, transformedSubschema }) => {
    if (!isSubschemaConfig(transformedSubschema)) return;
    if (transformedSubschema.merge?.[type.name]?.fields?.[fieldName]?.canonical) {
      canonicalByField.push(fieldConfig);
    } else if (transformedSubschema.merge?.[type.name]?.canonical) {
      canonicalByType.push(fieldConfig);
    }
  });

  if (canonicalByField.length > 1) {
    throw new Error(`Multiple canonical definitions for "${candidates[0].type.name}.${candidates[0].fieldName}"`);
  } else if (canonicalByField.length) {
    return canonicalByField[0];
  } else if (canonicalByType.length) {
    return canonicalByType[0];
  }

  return candidates[candidates.length - 1].fieldConfig;
}

function inputFieldConfigMapFromTypeCandidates<TContext = Record<string, any>>(
  candidates: Array<MergeTypeCandidate<TContext>>,
  typeMergingOptions?: TypeMergingOptions<TContext>
): GraphQLInputFieldConfigMap {
  const inputFieldConfigCandidatesMap: Record<string, Array<MergeInputFieldConfigCandidate<TContext>>> = Object.create(
    null
  );
  const fieldInclusionMap: Record<string, number> = Object.create(null);

  candidates.forEach(candidate => {
    const typeConfig = (candidate.type as GraphQLInputObjectType).toConfig();
    const inputFieldConfigMap = typeConfig.fields;
    Object.entries(inputFieldConfigMap).forEach(([fieldName, inputFieldConfig]) => {
      fieldInclusionMap[fieldName] = fieldInclusionMap[fieldName] || 0;
      fieldInclusionMap[fieldName] += 1;

      const inputFieldConfigCandidate = {
        inputFieldConfig,
        fieldName,
        type: candidate.type as GraphQLInputObjectType,
        subschema: candidate.subschema,
        transformedSubschema: candidate.transformedSubschema,
      };

      if (fieldName in inputFieldConfigCandidatesMap) {
        inputFieldConfigCandidatesMap[fieldName].push(inputFieldConfigCandidate);
      } else {
        inputFieldConfigCandidatesMap[fieldName] = [inputFieldConfigCandidate];
      }
    });
  });

  validateInputObjectConsistency(fieldInclusionMap, candidates, typeMergingOptions);

  const inputFieldConfigMap = Object.create(null);

  Object.keys(inputFieldConfigCandidatesMap).forEach(fieldName => {
    const inputFieldConfigMerger = typeMergingOptions?.inputFieldConfigMerger ?? defaultInputFieldConfigMerger;
    inputFieldConfigMap[fieldName] = inputFieldConfigMerger(inputFieldConfigCandidatesMap[fieldName]);
    validateInputFieldConsistency(
      inputFieldConfigMap[fieldName],
      inputFieldConfigCandidatesMap[fieldName],
      typeMergingOptions
    );
  });

  return inputFieldConfigMap;
}

function defaultInputFieldConfigMerger<TContext = Record<string, any>>(
  candidates: Array<MergeInputFieldConfigCandidate<TContext>>
) {
  const canonicalByField: Array<GraphQLInputFieldConfig> = [];
  const canonicalByType: Array<GraphQLInputFieldConfig> = [];

  candidates.forEach(({ type, fieldName, inputFieldConfig, transformedSubschema }) => {
    if (!isSubschemaConfig(transformedSubschema)) return;
    if (transformedSubschema.merge?.[type.name]?.fields?.[fieldName]?.canonical) {
      canonicalByField.push(inputFieldConfig);
    } else if (transformedSubschema.merge?.[type.name]?.canonical) {
      canonicalByType.push(inputFieldConfig);
    }
  });

  if (canonicalByField.length > 1) {
    throw new Error(`Multiple canonical definitions for "${candidates[0].type.name}.${candidates[0].fieldName}"`);
  } else if (canonicalByField.length) {
    return canonicalByField[0];
  } else if (canonicalByType.length) {
    return canonicalByType[0];
  }

  return candidates[candidates.length - 1].inputFieldConfig;
}

function canonicalFieldNamesForType<TContext>(candidates: Array<MergeTypeCandidate<TContext>>): Array<string> {
  const canonicalFieldNames: Record<string, boolean> = Object.create(null);

  candidates.forEach(({ type, transformedSubschema }) => {
    if (!isSubschemaConfig(transformedSubschema)) {
      return;
    }
    const mergeConfig = transformedSubschema.merge?.[type.name];
    if (mergeConfig != null && mergeConfig.fields != null && !mergeConfig.canonical) {
      Object.entries(mergeConfig.fields).forEach(([fieldName, mergedFieldConfig]) => {
        if (mergedFieldConfig.canonical) {
          canonicalFieldNames[fieldName] = true;
        }
      });
    }
  });

  return Object.keys(canonicalFieldNames);
}
