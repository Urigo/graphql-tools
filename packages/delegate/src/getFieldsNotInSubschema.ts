import { GraphQLSchema, FieldNode, GraphQLObjectType, GraphQLResolveInfo } from 'graphql';

import { collectFields, GraphQLExecutionContext, Maybe } from '@graphql-tools/utils';

import { isSubschemaConfig } from './subschemaConfig';
import { MergedTypeInfo, SubschemaConfig, StitchingInfo } from './types';
import { memoizeInfoAnd2Objects } from './memoize';

function collectSubFields(info: GraphQLResolveInfo, typeName: string): Record<string, Array<FieldNode>> {
  let subFieldNodes: Record<string, Array<FieldNode>> = Object.create(null);
  const visitedFragmentNames = Object.create(null);

  const type = info.schema.getType(typeName) as GraphQLObjectType;
  const partialExecutionContext = {
    schema: info.schema,
    variableValues: info.variableValues,
    fragments: info.fragments,
  } as unknown as GraphQLExecutionContext;

  for (const fieldNode of info.fieldNodes) {
    if (fieldNode.selectionSet) {
      subFieldNodes = collectFields(
        partialExecutionContext,
        type,
        fieldNode.selectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }

  // TODO: Verify whether it is safe that extensions always exists.
  const stitchingInfo: Maybe<StitchingInfo> = info.schema.extensions?.['stitchingInfo'];
  const selectionSetsByField = stitchingInfo?.selectionSetsByField;

  for (const responseName in subFieldNodes) {
    const fieldName = subFieldNodes[responseName][0].name.value;
    const fieldSelectionSet = selectionSetsByField?.[typeName]?.[fieldName];
    if (fieldSelectionSet != null) {
      subFieldNodes = collectFields(
        partialExecutionContext,
        type,
        fieldSelectionSet,
        subFieldNodes,
        visitedFragmentNames
      );
    }
  }

  return subFieldNodes;
}

export const getFieldsNotInSubschema = memoizeInfoAnd2Objects(function (
  info: GraphQLResolveInfo,
  subschema: GraphQLSchema | SubschemaConfig<any, any, any, any>,
  mergedTypeInfo: MergedTypeInfo
): Array<FieldNode> {
  const typeMap = isSubschemaConfig(subschema) ? mergedTypeInfo.typeMaps.get(subschema) : subschema.getTypeMap();
  if (!typeMap) {
    return [];
  }
  const typeName = mergedTypeInfo.typeName;
  const fields = (typeMap[typeName] as GraphQLObjectType).getFields();

  const subFieldNodes = collectSubFields(info, typeName);

  let fieldsNotInSchema: Array<FieldNode> = [];
  for (const responseName in subFieldNodes) {
    const fieldName = subFieldNodes[responseName][0].name.value;
    if (!(fieldName in fields)) {
      fieldsNotInSchema = fieldsNotInSchema.concat(subFieldNodes[responseName]);
    }
  }

  return fieldsNotInSchema;
});
