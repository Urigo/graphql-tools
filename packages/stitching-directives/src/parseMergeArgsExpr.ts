import { parseValue, SelectionSetNode, valueFromASTUntyped } from 'graphql';

import { Expansion, MappingInstruction, ParsedMergeArgsExpr } from './types';

import { extractVariables } from './extractVariables';
import { EXPANSION_PREFIX, KEY_DELIMITER, preparseMergeArgsExpr } from './preparseMergeArgsExpr';
import { propertyTreeFromPaths } from './properties';
import { getSourcePaths } from './getSourcePaths';

type VariablePaths = Record<string, Array<string | number>>;

export function parseMergeArgsExpr(mergeArgsExpr: string, selectionSet?: SelectionSetNode): ParsedMergeArgsExpr {
  const { mergeArgsExpr: newMergeArgsExpr, expansionExpressions } = preparseMergeArgsExpr(mergeArgsExpr);

  const inputValue = parseValue(`{ ${newMergeArgsExpr} }`, { noLocation: true });

  const { inputValue: newInputValue, variablePaths } = extractVariables(inputValue);

  if (!Object.keys(expansionExpressions).length) {
    if (!Object.keys(variablePaths).length) {
      throw new Error('Merge arguments must declare a key.');
    }

    const mappingInstructions = getMappingInstructions(variablePaths);

    const usedProperties = propertyTreeFromPaths(getSourcePaths(mappingInstructions, selectionSet));

    return { args: valueFromASTUntyped(newInputValue), usedProperties, mappingInstructions };
  }

  const expansionRegEx = new RegExp(`^${EXPANSION_PREFIX}[0-9]+$`);
  for (const variableName in variablePaths) {
    if (!variableName.match(expansionRegEx)) {
      throw new Error('Expansions cannot be mixed with single key declarations.');
    }
  }

  const expansions: Array<Expansion> = [];
  const sourcePaths: Array<Array<string>> = [];
  for (const variableName in expansionExpressions) {
    const str = expansionExpressions[variableName];
    const valuePath = variablePaths[variableName];
    const { inputValue: expansionInputValue, variablePaths: expansionVariablePaths } = extractVariables(
      parseValue(`${str}`, { noLocation: true })
    );

    if (!Object.keys(expansionVariablePaths).length) {
      throw new Error('Merge arguments must declare a key.');
    }

    const mappingInstructions = getMappingInstructions(expansionVariablePaths);

    const value = valueFromASTUntyped(expansionInputValue);

    sourcePaths.push(...getSourcePaths(mappingInstructions, selectionSet));

    assertNotWithinList(valuePath);
    expansions.push({
      valuePath,
      value,
      mappingInstructions,
    });
  }

  const usedProperties = propertyTreeFromPaths(sourcePaths);

  return { args: valueFromASTUntyped(newInputValue), usedProperties, expansions };
}

function getMappingInstructions(variablePaths: VariablePaths): Array<MappingInstruction> {
  const mappingInstructions: Array<MappingInstruction> = [];
  for (const keyPath in variablePaths) {
    const valuePath = variablePaths[keyPath];
    const splitKeyPath = keyPath.split(KEY_DELIMITER).slice(1);

    assertNotWithinList(valuePath);
    mappingInstructions.push({
      destinationPath: valuePath,
      sourcePath: splitKeyPath,
    });
  }

  return mappingInstructions;
}

function assertNotWithinList(path: Array<string | number>): asserts path is string[] {
  for (const pathSegment of path) {
    if (typeof pathSegment === 'number') {
      throw new Error('Insertions cannot be made into a list.');
    }
  }
}
