import {
  GraphQLObjectType,
  GraphQLSchema,
  Kind,
  SelectionSetNode,
  isObjectType,
  isScalarType,
  getNamedType,
  GraphQLInterfaceType,
  SelectionNode,
  print,
  isInterfaceType,
  isLeafType,
} from 'graphql';

import { parseSelectionSet, TypeMap, IResolvers, IFieldResolverOptions, isSome } from '@graphql-tools/utils';

import { MergedTypeResolver, Subschema, SubschemaConfig, MergedTypeInfo, StitchingInfo } from '@graphql-tools/delegate';

import { MergeTypeCandidate, MergeTypeFilter } from './types';

import { createMergedTypeResolver } from './createMergedTypeResolver';

export function createStitchingInfo<TContext = Record<string, any>>(
  subschemaMap: Map<GraphQLSchema | SubschemaConfig<any, any, any, TContext>, Subschema<any, any, any, TContext>>,
  typeCandidates: Record<string, Array<MergeTypeCandidate<TContext>>>,
  mergeTypes?: boolean | Array<string> | MergeTypeFilter<TContext>
): StitchingInfo<TContext> {
  const mergedTypes = createMergedTypes(typeCandidates, mergeTypes);
  const selectionSetsByField: Record<string, Record<string, SelectionSetNode>> = Object.create(null);

  Object.entries(mergedTypes).forEach(([typeName, mergedTypeInfo]) => {
    if (mergedTypeInfo.selectionSets == null && mergedTypeInfo.fieldSelectionSets == null) {
      return;
    }

    selectionSetsByField[typeName] = Object.create(null);

    mergedTypeInfo.selectionSets.forEach((selectionSet, subschemaConfig) => {
      const schema = subschemaConfig.transformedSchema;
      const type = schema.getType(typeName) as GraphQLObjectType;
      const fields = type.getFields();
      Object.keys(fields).forEach(fieldName => {
        const field = fields[fieldName];
        const fieldType = getNamedType(field.type);
        if (selectionSet && isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
          return;
        }
        if (selectionSetsByField[typeName][fieldName] == null) {
          selectionSetsByField[typeName][fieldName] = {
            kind: Kind.SELECTION_SET,
            selections: [parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
          };
        }
        selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][
          fieldName
        ].selections.concat(selectionSet.selections);
      });
    });

    mergedTypeInfo.fieldSelectionSets.forEach(selectionSetFieldMap => {
      Object.keys(selectionSetFieldMap).forEach(fieldName => {
        if (selectionSetsByField[typeName][fieldName] == null) {
          selectionSetsByField[typeName][fieldName] = {
            kind: Kind.SELECTION_SET,
            selections: [parseSelectionSet('{ __typename }', { noLocation: true }).selections[0]],
          };
        }
        selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][
          fieldName
        ].selections.concat(selectionSetFieldMap[fieldName].selections);
      });
    });
  });

  return {
    subschemaMap,
    selectionSetsByType: undefined,
    selectionSetsByField,
    dynamicSelectionSetsByField: undefined,
    mergedTypes,
  };
}

function createMergedTypes<TContext = Record<string, any>>(
  typeCandidates: Record<string, Array<MergeTypeCandidate<TContext>>>,
  mergeTypes?: boolean | Array<string> | MergeTypeFilter<TContext>
): Record<string, MergedTypeInfo<TContext>> {
  const mergedTypes: Record<string, MergedTypeInfo<TContext>> = Object.create(null);

  Object.keys(typeCandidates).forEach(typeName => {
    if (
      typeCandidates[typeName].length > 1 &&
      (isObjectType(typeCandidates[typeName][0].type) || isInterfaceType(typeCandidates[typeName][0].type))
    ) {
      const typeCandidatesWithMergedTypeConfig = typeCandidates[typeName].filter(
        typeCandidate =>
          typeCandidate.transformedSubschema != null &&
          typeCandidate.transformedSubschema.merge != null &&
          typeName in typeCandidate.transformedSubschema.merge
      );

      if (
        mergeTypes === true ||
        (typeof mergeTypes === 'function' && mergeTypes(typeCandidates[typeName], typeName)) ||
        (Array.isArray(mergeTypes) && mergeTypes.includes(typeName)) ||
        typeCandidatesWithMergedTypeConfig.length
      ) {
        const targetSubschemas: Array<Subschema<any, any, any, TContext>> = [];

        const typeMaps: Map<GraphQLSchema | SubschemaConfig<any, any, any, TContext>, TypeMap> = new Map();
        const supportedBySubschemas: Record<string, Array<Subschema<any, any, any, TContext>>> = Object.create({});
        const selectionSets: Map<Subschema<any, any, any, TContext>, SelectionSetNode> = new Map();
        const fieldSelectionSets: Map<Subschema<any, any, any, TContext>, Record<string, SelectionSetNode>> = new Map();
        const resolvers: Map<Subschema<any, any, any, TContext>, MergedTypeResolver<TContext>> = new Map();

        typeCandidates[typeName].forEach(typeCandidate => {
          const subschema = typeCandidate.transformedSubschema;

          if (subschema == null) {
            return;
          }

          typeMaps.set(subschema, subschema.transformedSchema.getTypeMap());

          const mergedTypeConfig = subschema?.merge?.[typeName];

          if (mergedTypeConfig == null) {
            return;
          }

          if (mergedTypeConfig.selectionSet) {
            const selectionSet = parseSelectionSet(mergedTypeConfig.selectionSet, { noLocation: true });
            selectionSets.set(subschema, selectionSet);
          }

          if (mergedTypeConfig.fields) {
            const parsedFieldSelectionSets = Object.create(null);
            for (const fieldName in mergedTypeConfig.fields) {
              if (mergedTypeConfig.fields[fieldName].selectionSet) {
                const rawFieldSelectionSet = mergedTypeConfig.fields[fieldName].selectionSet;
                parsedFieldSelectionSets[fieldName] = rawFieldSelectionSet
                  ? parseSelectionSet(rawFieldSelectionSet, { noLocation: true })
                  : undefined;
              }
            }
            fieldSelectionSets.set(subschema, parsedFieldSelectionSets);
          }

          const resolver = mergedTypeConfig.resolve ?? createMergedTypeResolver(mergedTypeConfig);

          if (resolver == null) {
            return;
          }

          const keyFn = mergedTypeConfig.key;
          resolvers.set(
            subschema,
            keyFn
              ? (originalResult, context, info, subschema, selectionSet) => {
                  const key = keyFn(originalResult);
                  return resolver(originalResult, context, info, subschema, selectionSet, key);
                }
              : resolver
          );

          targetSubschemas.push(subschema);

          const type = subschema.transformedSchema.getType(typeName) as GraphQLObjectType | GraphQLInterfaceType;
          const fieldMap = type.getFields();
          const selectionSet = selectionSets.get(subschema);
          Object.keys(fieldMap).forEach(fieldName => {
            const field = fieldMap[fieldName];
            const fieldType = getNamedType(field.type);
            if (selectionSet && isLeafType(fieldType) && selectionSetContainsTopLevelField(selectionSet, fieldName)) {
              return;
            }
            if (!(fieldName in supportedBySubschemas)) {
              supportedBySubschemas[fieldName] = [];
            }
            supportedBySubschemas[fieldName].push(subschema);
          });
        });

        const sourceSubschemas = typeCandidates[typeName]
          .map(typeCandidate => typeCandidate?.transformedSubschema)
          .filter(isSome);
        const targetSubschemasBySubschema: Map<
          Subschema<any, any, any, TContext>,
          Array<Subschema<any, any, any, TContext>>
        > = new Map();
        sourceSubschemas.forEach(subschema => {
          const filteredSubschemas = targetSubschemas.filter(s => s !== subschema);
          if (filteredSubschemas.length) {
            targetSubschemasBySubschema.set(subschema, filteredSubschemas);
          }
        });

        mergedTypes[typeName] = {
          typeName,
          targetSubschemas: targetSubschemasBySubschema,
          typeMaps,
          selectionSets,
          fieldSelectionSets,
          uniqueFields: Object.create({}),
          nonUniqueFields: Object.create({}),
          resolvers,
        };

        Object.keys(supportedBySubschemas).forEach(fieldName => {
          if (supportedBySubschemas[fieldName].length === 1) {
            mergedTypes[typeName].uniqueFields[fieldName] = supportedBySubschemas[fieldName][0];
          } else {
            mergedTypes[typeName].nonUniqueFields[fieldName] = supportedBySubschemas[fieldName];
          }
        });
      }
    }
  });

  return mergedTypes;
}

export function completeStitchingInfo<TContext = Record<string, any>>(
  stitchingInfo: StitchingInfo<TContext>,
  resolvers: IResolvers,
  schema: GraphQLSchema
): StitchingInfo<TContext> {
  const selectionSetsByType = Object.create(null);
  [schema.getQueryType(), schema.getMutationType()].forEach(rootType => {
    if (rootType) {
      selectionSetsByType[rootType.name] = parseSelectionSet('{ __typename }', { noLocation: true });
    }
  });

  const selectionSetsByField = stitchingInfo.selectionSetsByField;
  const dynamicSelectionSetsByField = Object.create(null);

  Object.keys(resolvers).forEach(typeName => {
    const type = resolvers[typeName];
    if (isScalarType(type)) {
      return;
    }
    Object.keys(type).forEach(fieldName => {
      const field = type[fieldName] as IFieldResolverOptions;
      if (field.selectionSet) {
        if (typeof field.selectionSet === 'function') {
          if (!(typeName in dynamicSelectionSetsByField)) {
            dynamicSelectionSetsByField[typeName] = Object.create(null);
          }

          if (!(fieldName in dynamicSelectionSetsByField[typeName])) {
            dynamicSelectionSetsByField[typeName][fieldName] = [];
          }

          dynamicSelectionSetsByField[typeName][fieldName].push(field.selectionSet);
        } else {
          const selectionSet = parseSelectionSet(field.selectionSet, { noLocation: true });
          if (!(typeName in selectionSetsByField)) {
            selectionSetsByField[typeName] = Object.create(null);
          }

          if (!(fieldName in selectionSetsByField[typeName])) {
            selectionSetsByField[typeName][fieldName] = {
              kind: Kind.SELECTION_SET,
              selections: [],
            };
          }
          selectionSetsByField[typeName][fieldName].selections = selectionSetsByField[typeName][
            fieldName
          ].selections.concat(selectionSet.selections);
        }
      }
    });
  });

  Object.keys(selectionSetsByField).forEach(typeName => {
    const typeSelectionSets = selectionSetsByField[typeName];
    Object.keys(typeSelectionSets).forEach(fieldName => {
      const consolidatedSelections: Map<string, SelectionNode> = new Map();
      const selectionSet = typeSelectionSets[fieldName];
      selectionSet.selections.forEach(selection => {
        consolidatedSelections.set(print(selection), selection);
      });
      selectionSet.selections = Array.from(consolidatedSelections.values());
    });
  });

  stitchingInfo.selectionSetsByType = selectionSetsByType;
  stitchingInfo.selectionSetsByField = selectionSetsByField;
  stitchingInfo.dynamicSelectionSetsByField = dynamicSelectionSetsByField;

  return stitchingInfo;
}

export function addStitchingInfo<TContext = Record<string, any>>(
  stitchedSchema: GraphQLSchema,
  stitchingInfo: StitchingInfo<TContext>
): GraphQLSchema {
  return new GraphQLSchema({
    ...stitchedSchema.toConfig(),
    extensions: {
      ...stitchedSchema.extensions,
      stitchingInfo,
    },
  });
}

export function selectionSetContainsTopLevelField(selectionSet: SelectionSetNode, fieldName: string) {
  return selectionSet.selections.some(selection => selection.kind === Kind.FIELD && selection.name.value === fieldName);
}
