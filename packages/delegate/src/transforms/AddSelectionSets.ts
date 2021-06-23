import { SelectionSetNode, TypeInfo, Kind, FieldNode, SelectionNode, print } from 'graphql';

import { Maybe, Request } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '../types';
import { memoize2 } from '../memoize';

import VisitSelectionSets from './VisitSelectionSets';

export default class AddSelectionSets implements Transform {
  private readonly transformer: VisitSelectionSets;

  constructor(
    selectionSetsByType: Record<string, SelectionSetNode>,
    selectionSetsByField: Record<string, Record<string, SelectionSetNode>>,
    dynamicSelectionSetsByField: Record<string, Record<string, Array<(node: FieldNode) => SelectionSetNode>>>
  ) {
    this.transformer = new VisitSelectionSets((node, typeInfo) =>
      visitSelectionSet(node, typeInfo, selectionSetsByType, selectionSetsByField, dynamicSelectionSetsByField)
    );
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): Request {
    return this.transformer.transformRequest(originalRequest, delegationContext, transformationContext);
  }
}

function visitSelectionSet(
  node: SelectionSetNode,
  typeInfo: TypeInfo,
  selectionSetsByType: Record<string, SelectionSetNode>,
  selectionSetsByField: Record<string, Record<string, SelectionSetNode>>,
  dynamicSelectionSetsByField: Record<string, Record<string, Array<(node: FieldNode) => SelectionSetNode>>>
): Maybe<SelectionSetNode> {
  const parentType = typeInfo.getParentType();

  const newSelections: Map<string, SelectionNode> = new Map();

  if (parentType != null) {
    const parentTypeName = parentType.name;
    addSelectionsToMap(newSelections, node);

    if (parentTypeName in selectionSetsByType) {
      const selectionSet = selectionSetsByType[parentTypeName];
      addSelectionsToMap(newSelections, selectionSet);
    }

    if (parentTypeName in selectionSetsByField) {
      node.selections.forEach(selection => {
        if (selection.kind === Kind.FIELD) {
          const name = selection.name.value;
          const selectionSet = selectionSetsByField[parentTypeName][name];
          if (selectionSet != null) {
            addSelectionsToMap(newSelections, selectionSet);
          }
        }
      });
    }

    if (parentTypeName in dynamicSelectionSetsByField) {
      node.selections.forEach(selection => {
        if (selection.kind === Kind.FIELD) {
          const name = selection.name.value;
          const dynamicSelectionSets = dynamicSelectionSetsByField[parentTypeName][name];
          if (dynamicSelectionSets != null) {
            dynamicSelectionSets.forEach(selectionSetFn => {
              const selectionSet = selectionSetFn(selection);
              if (selectionSet != null) {
                addSelectionsToMap(newSelections, selectionSet);
              }
            });
          }
        }
      });
    }

    return {
      ...node,
      selections: Array.from(newSelections.values()),
    };
  }
}

const addSelectionsToMap = memoize2(function (map: Map<string, SelectionNode>, selectionSet: SelectionSetNode): void {
  selectionSet.selections.forEach(selection => {
    map.set(print(selection), selection);
  });
});
