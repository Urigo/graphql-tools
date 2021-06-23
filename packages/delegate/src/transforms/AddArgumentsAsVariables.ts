import {
  ArgumentNode,
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLArgument,
  GraphQLField,
  GraphQLObjectType,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  VariableDefinitionNode,
} from 'graphql';

import { Maybe, Request, serializeInputValue, updateArgument, assertSome } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '../types';

export default class AddArgumentsAsVariables implements Transform {
  private readonly args: Record<string, any>;

  constructor(args: Record<string, any>) {
    this.args = Object.entries(args).reduce(
      (prev, [key, val]) => ({
        ...prev,
        [key]: val,
      }),
      {}
    );
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): Request {
    const { document, variables } = addVariablesToRootField(delegationContext.targetSchema, originalRequest, this.args);

    return {
      ...originalRequest,
      document,
      variables,
    };
  }
}

function addVariablesToRootField(
  targetSchema: GraphQLSchema,
  originalRequest: Request,
  args: Record<string, any>
): {
  document: DocumentNode;
  variables: Record<string, any>;
} {
  const document = originalRequest.document;
  const variableValues = originalRequest.variables;

  const operations: Array<OperationDefinitionNode> = document.definitions.filter(
    def => def.kind === Kind.OPERATION_DEFINITION
  ) as Array<OperationDefinitionNode>;
  const fragments: Array<FragmentDefinitionNode> = document.definitions.filter(
    def => def.kind === Kind.FRAGMENT_DEFINITION
  ) as Array<FragmentDefinitionNode>;

  const newOperations = operations.map((operation: OperationDefinitionNode) => {
    const variableDefinitionMap: Record<string, VariableDefinitionNode> = (operation.variableDefinitions ?? []).reduce(
      (prev, def) => ({
        ...prev,
        [def.variable.name.value]: def,
      }),
      {}
    );

    let type: Maybe<GraphQLObjectType>;
    if (operation.operation === 'subscription') {
      type = targetSchema.getSubscriptionType();
    } else if (operation.operation === 'mutation') {
      type = targetSchema.getMutationType();
    } else {
      type = targetSchema.getQueryType();
    }

    assertSome(type);

    const newSelectionSet: Array<SelectionNode> = [];

    for (const selection of operation.selectionSet.selections) {
      if (selection.kind === Kind.FIELD) {
        const argumentNodes = selection.arguments ?? [];
        const argumentNodeMap: Record<string, ArgumentNode> = argumentNodes.reduce(
          (prev, argument) => ({
            ...prev,
            [argument.name.value]: argument,
          }),
          {}
        );

        const targetField = type.getFields()[selection.name.value];

        // excludes __typename
        if (targetField != null) {
          updateArguments(targetField, argumentNodeMap, variableDefinitionMap, variableValues, args);
        }

        newSelectionSet.push({
          ...selection,
          arguments: Object.keys(argumentNodeMap).map(argName => argumentNodeMap[argName]),
        });
      } else {
        newSelectionSet.push(selection);
      }
    }

    return {
      ...operation,
      variableDefinitions: Object.keys(variableDefinitionMap).map(varName => variableDefinitionMap[varName]),
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: newSelectionSet,
      },
    };
  });

  return {
    document: {
      ...document,
      definitions: [...newOperations, ...fragments],
    },
    variables: variableValues,
  };
}

function updateArguments(
  targetField: GraphQLField<any, any>,
  argumentNodeMap: Record<string, ArgumentNode>,
  variableDefinitionMap: Record<string, VariableDefinitionNode>,
  variableValues: Record<string, any>,
  newArgs: Record<string, any>
): void {
  targetField.args.forEach((argument: GraphQLArgument) => {
    const argName = argument.name;
    const argType = argument.type;

    if (argName in newArgs) {
      updateArgument(
        argName,
        argType,
        argumentNodeMap,
        variableDefinitionMap,
        variableValues,
        serializeInputValue(argType, newArgs[argName])
      );
    }
  });
}
