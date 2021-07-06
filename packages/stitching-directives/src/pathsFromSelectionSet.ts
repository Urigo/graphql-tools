import { Kind, SelectionNode, SelectionSetNode } from 'graphql';

export function pathsFromSelectionSet(selectionSet: SelectionSetNode, path: Array<string> = []): Array<Array<string>> {
  const paths: Array<Array<string>> = [];
  for (const selection of selectionSet.selections) {
    const additions = pathsFromSelection(selection, path) ?? [];
    for (const addition of additions) {
      paths.push(addition);
    }
  }
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
