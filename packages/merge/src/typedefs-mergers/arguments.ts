import { InputValueDefinitionNode } from 'graphql';
import { Config } from '.';
import { compareNodes, isSome } from '@graphql-tools/utils';

export function mergeArguments(
  args1: InputValueDefinitionNode[],
  args2: InputValueDefinitionNode[],
  config?: Config
): InputValueDefinitionNode[] {
  const result = deduplicateArguments([...args2, ...args1].filter(isSome));
  if (config && config.sort) {
    result.sort(compareNodes);
  }
  return result;
}

function deduplicateArguments(args: ReadonlyArray<InputValueDefinitionNode>): InputValueDefinitionNode[] {
  return args.reduce<InputValueDefinitionNode[]>((acc, current) => {
    const dup = acc.find(arg => arg.name.value === current.name.value);

    if (!dup) {
      return acc.concat([current]);
    }

    return acc;
  }, []);
}
