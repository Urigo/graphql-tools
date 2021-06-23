import { Kind, ObjectFieldNode, ValueNode, VariableNode, visit } from 'graphql';

type VariablePaths = Record<string, Array<string | number>>;

export function extractVariables(inputValue: ValueNode): { inputValue: ValueNode; variablePaths: VariablePaths } {
  const path: Array<string | number> = [];
  const variablePaths = Object.create(null);

  const keyPathVisitor = {
    enter: (_node: any, key: string | number | undefined) => {
      if (typeof key === 'number') {
        path.push(key);
      }
    },
    leave: (_node: any, key: string | number | undefined) => {
      if (typeof key === 'number') {
        path.pop();
      }
    },
  };

  const fieldPathVisitor = {
    enter: (node: ObjectFieldNode) => {
      path.push(node.name.value);
    },
    leave: () => {
      path.pop();
    },
  };

  const variableVisitor = {
    enter: (node: VariableNode, key: string | number | undefined) => {
      if (typeof key === 'number') {
        variablePaths[node.name.value] = path.concat([key]);
      } else {
        variablePaths[node.name.value] = path.slice();
      }
      return {
        kind: Kind.NULL,
      };
    },
  };

  const newInputValue: ValueNode = visit(inputValue, {
    [Kind.OBJECT]: keyPathVisitor,
    [Kind.LIST]: keyPathVisitor,
    [Kind.OBJECT_FIELD]: fieldPathVisitor,
    [Kind.VARIABLE]: variableVisitor,
  });

  return {
    inputValue: newInputValue,
    variablePaths,
  };
}
