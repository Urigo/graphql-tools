import { SelectionSetNode, TypeNameMetaFieldDef } from 'graphql';

import { MappingInstruction } from './types';

import { pathsFromSelectionSet } from './pathsFromSelectionSet';

export function getSourcePaths(
  mappingInstructions: Array<MappingInstruction>,
  selectionSet?: SelectionSetNode
): Array<Array<string>> {
  const sourcePaths: Array<Array<string>> = [];
  for (const mappingInstruction of mappingInstructions) {
    const { sourcePath } = mappingInstruction;
    if (sourcePath.length) {
      sourcePaths.push(sourcePath);
      continue;
    }

    if (selectionSet == null) {
      continue;
    }

    const paths = pathsFromSelectionSet(selectionSet);
    for (const path of paths) {
      sourcePaths.push(path);
    }

    sourcePaths.push([TypeNameMetaFieldDef.name]);
  }

  return sourcePaths;
}
