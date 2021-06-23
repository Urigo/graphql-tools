import { parseSelectionSet } from '@graphql-tools/utils';
import { SelectionSetNode, SelectionNode, FieldNode, Kind } from 'graphql';

export const forwardArgsToSelectionSet: (
  selectionSet: string,
  mapping?: Record<string, string[]>
) => (field: FieldNode) => SelectionSetNode = (selectionSet: string, mapping?: Record<string, string[]>) => {
  const selectionSetDef = parseSelectionSet(selectionSet, { noLocation: true });
  return (field: FieldNode): SelectionSetNode => {
    const selections = selectionSetDef.selections.map((selectionNode): SelectionNode => {
      if (selectionNode.kind === Kind.FIELD) {
        if (!mapping) {
          return { ...selectionNode, arguments: field.arguments?.slice() };
        } else if (selectionNode.name.value in mapping) {
          const selectionArgs = mapping[selectionNode.name.value];
          return {
            ...selectionNode,
            arguments: field.arguments?.filter((arg): boolean => selectionArgs.includes(arg.name.value)),
          };
        }
      }
      return selectionNode;
    });

    return { ...selectionSetDef, selections };
  };
};
