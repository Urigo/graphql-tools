import { Kind, SelectionNode, SelectionSetNode } from 'graphql';

export function pathsFromSelectionSet(selectionSet: SelectionSetNode, path: Array<string> = []): Array<Array<string>> {
  let paths: Array<Array<string>> = [];
  selectionSet.selections.forEach(selection => {
    const addition = pathsFromSelection(selection, path) ?? [];
    paths = [...paths, ...addition];
  });
  return paths;
}

function pathsFromSelection(selection: SelectionNode, path: Array<string>): Array<Array<string>> | undefined {
  if (selection.kind === Kind.FIELD) {
    const responseKey = selection.alias?.value ?? selection.name.value;
    if (selection.selectionSet) {
      return pathsFromSelectionSet(selection.selectionSet, path.concat([responseKey]));
    } else {
      return [path.concat([responseKey])];
    }
  } else if (selection.kind === Kind.INLINE_FRAGMENT) {
    return pathsFromSelectionSet(selection.selectionSet, path);
  }
}
