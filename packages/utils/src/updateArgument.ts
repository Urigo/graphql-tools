import { GraphQLInputType, ArgumentNode, VariableDefinitionNode, Kind } from 'graphql';

import { astFromType } from './astFromType';

export function updateArgument(
  argumentNodes: Record<string, ArgumentNode>,
  variableDefinitionsMap: Record<string, VariableDefinitionNode>,
  variableValues: Record<string, any>,
  argName: string,
  varName: string,
  type: GraphQLInputType,
  value: any
): void {
  argumentNodes[argName] = {
    kind: Kind.ARGUMENT,
    name: {
      kind: Kind.NAME,
      value: argName,
    },
    value: {
      kind: Kind.VARIABLE,
      name: {
        kind: Kind.NAME,
        value: varName,
      },
    },
  };

  variableDefinitionsMap[varName] = {
    kind: Kind.VARIABLE_DEFINITION,
    variable: {
      kind: Kind.VARIABLE,
      name: {
        kind: Kind.NAME,
        value: varName,
      },
    },
    type: astFromType(type),
  };

  if (value !== undefined) {
    variableValues[varName] = value;
    return;
  }

  // including the variable in the map with value of `undefined`
  // will actually be translated by graphql-js into `null`
  // see https://github.com/graphql/graphql-js/issues/2533
  if (varName in variableValues) {
    delete variableValues[varName];
  }
}

export function createVariableNameGenerator(
  variableDefinitionMap: Record<string, VariableDefinitionNode>
): (argName: string) => string {
  let varCounter = 0;
  return (argName: string): string => {
    let varName: string;
    do {
      varName = `_v${(varCounter++).toString()}_${argName}`;
    } while (varName in variableDefinitionMap);
    return varName;
  };
}
