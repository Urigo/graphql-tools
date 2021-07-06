import {
  ArgumentNode,
  FieldNode,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  GraphQLSchema,
  GraphQLObjectType,
  OperationTypeNode,
  typeFromAST,
  NamedTypeNode,
  GraphQLInputType,
  VariableDefinitionNode,
  SelectionSetNode,
  DefinitionNode,
  DocumentNode,
} from 'graphql';

import { Request, serializeInputValue, updateArgument } from '@graphql-tools/utils';
import { ICreateRequestFromInfo, ICreateRequest } from './types';

export function getDelegatingOperation(parentType: GraphQLObjectType, schema: GraphQLSchema): OperationTypeNode {
  if (parentType === schema.getMutationType()) {
    return 'mutation';
  } else if (parentType === schema.getSubscriptionType()) {
    return 'subscription';
  }

  return 'query';
}

export function createRequestFromInfo({
  info,
  operationName,
  operation = getDelegatingOperation(info.parentType, info.schema),
  fieldName = info.fieldName,
  selectionSet,
  fieldNodes = info.fieldNodes,
}: ICreateRequestFromInfo): Request {
  return createRequest({
    sourceSchema: info.schema,
    sourceParentType: info.parentType,
    sourceFieldName: info.fieldName,
    fragments: info.fragments,
    variableDefinitions: info.operation.variableDefinitions,
    variableValues: info.variableValues,
    targetOperationName: operationName,
    targetOperation: operation,
    targetFieldName: fieldName,
    selectionSet,
    fieldNodes,
  });
}

const raiseError = (message: string) => {
  throw new Error(message);
};

export function createRequest({
  sourceSchema,
  sourceParentType,
  sourceFieldName,
  fragments,
  variableDefinitions,
  variableValues,
  targetOperationName,
  targetOperation,
  targetFieldName,
  selectionSet,
  fieldNodes,
}: ICreateRequest): Request {
  let newSelectionSet: SelectionSetNode | undefined;
  let argumentNodeMap: Record<string, ArgumentNode>;

  if (selectionSet != null) {
    newSelectionSet = selectionSet;
    argumentNodeMap = Object.create(null);
  } else {
    const selections: Array<SelectionNode> = (fieldNodes ?? []).reduce(
      (acc, fieldNode) => (fieldNode.selectionSet != null ? acc.concat(fieldNode.selectionSet.selections) : acc),
      [] as Array<SelectionNode>
    );

    newSelectionSet = selections.length
      ? {
          kind: Kind.SELECTION_SET,
          selections,
        }
      : undefined;

    argumentNodeMap = {};

    const args = fieldNodes?.[0]?.arguments;
    if (args) {
      argumentNodeMap = args.reduce(
        (prev, curr) => ({
          ...prev,
          [curr.name.value]: curr,
        }),
        argumentNodeMap
      );
    }
  }

  const newVariables = Object.create(null);
  const variableDefinitionMap = Object.create(null);

  if (sourceSchema != null && variableDefinitions != null) {
    for (const def of variableDefinitions) {
      const varName = def.variable.name.value;
      variableDefinitionMap[varName] = def;
      const varType = typeFromAST(sourceSchema, def.type as NamedTypeNode) as GraphQLInputType;
      const serializedValue = serializeInputValue(varType, variableValues?.[varName]);
      if (serializedValue !== undefined) {
        newVariables[varName] = serializedValue;
      }
    }
  }

  if (sourceParentType != null && sourceFieldName != null) {
    updateArgumentsWithDefaults(
      sourceParentType,
      sourceFieldName,
      argumentNodeMap,
      variableDefinitionMap,
      newVariables
    );
  }

  const rootfieldNode: FieldNode = {
    kind: Kind.FIELD,
    arguments: Object.values(argumentNodeMap),
    name: {
      kind: Kind.NAME,
      value:
        targetFieldName ??
        fieldNodes?.[0]?.name.value ??
        raiseError("Either 'targetFieldName' or a non empty 'fieldNodes' array must be provided."),
    },
    selectionSet: newSelectionSet,
  };

  const operationName = targetOperationName
    ? {
        kind: Kind.NAME,
        value: targetOperationName,
      }
    : undefined;

  const operationDefinition: OperationDefinitionNode = {
    kind: Kind.OPERATION_DEFINITION,
    name: operationName,
    operation: targetOperation,
    variableDefinitions: Object.values(variableDefinitionMap),
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [rootfieldNode],
    },
  };

  const definitions: Array<DefinitionNode> = [operationDefinition];

  if (fragments != null) {
    definitions.push(...Object.values(fragments));
  }

  const document: DocumentNode = {
    kind: Kind.DOCUMENT,
    definitions,
  };

  return {
    document,
    variables: newVariables,
    operationName: targetOperationName,
  };
}

function updateArgumentsWithDefaults(
  sourceParentType: GraphQLObjectType,
  sourceFieldName: string,
  argumentNodeMap: Record<string, ArgumentNode>,
  variableDefinitionMap: Record<string, VariableDefinitionNode>,
  variableValues: Record<string, any>
): void {
  const sourceField = sourceParentType.getFields()[sourceFieldName];
  for (const argument of sourceField.args) {
    const argName = argument.name;
    const sourceArgType = argument.type;

    if (argumentNodeMap[argName] === undefined) {
      const defaultValue = argument.defaultValue;

      if (defaultValue !== undefined) {
        updateArgument(
          argName,
          sourceArgType,
          argumentNodeMap,
          variableDefinitionMap,
          variableValues,
          serializeInputValue(sourceArgType, defaultValue)
        );
      }
    }
  }
}
