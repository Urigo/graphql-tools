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

import {
  createVariableNameGenerator,
  ExecutionRequest,
  serializeInputValue,
  updateArgument,
} from '@graphql-tools/utils';
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
  rootValue,
  operationName,
  operation = getDelegatingOperation(info.parentType, info.schema),
  fieldName = info.fieldName,
  selectionSet,
  fieldNodes = info.fieldNodes,
  context,
}: ICreateRequestFromInfo): ExecutionRequest {
  return createRequest({
    sourceSchema: info.schema,
    sourceParentType: info.parentType,
    sourceFieldName: info.fieldName,
    fragments: info.fragments,
    variableDefinitions: info.operation.variableDefinitions,
    variableValues: info.variableValues,
    targetRootValue: rootValue,
    targetOperationName: operationName,
    targetOperation: operation,
    targetFieldName: fieldName,
    selectionSet,
    fieldNodes,
    context,
    info,
  });
}

export function createRequest({
  sourceSchema,
  sourceParentType,
  sourceFieldName,
  fragments,
  variableDefinitions,
  variableValues,
  targetRootValue,
  targetOperationName,
  targetOperation,
  targetFieldName,
  selectionSet,
  fieldNodes,
  context,
  info,
}: ICreateRequest): ExecutionRequest {
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

  const rootFieldName = targetFieldName ?? fieldNodes?.[0]?.name.value;

  if (rootFieldName === undefined) {
    throw new Error(`Either "targetFieldName" or a non empty "fieldNodes" array must be provided.`);
  }

  const rootfieldNode: FieldNode = {
    kind: Kind.FIELD,
    arguments: Object.values(argumentNodeMap),
    name: {
      kind: Kind.NAME,
      value: rootFieldName,
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
    rootValue: targetRootValue,
    operationName: targetOperationName,
    operationType: targetOperation,
    context,
    info,
  };
}

function updateArgumentsWithDefaults(
  sourceParentType: GraphQLObjectType,
  sourceFieldName: string,
  argumentNodeMap: Record<string, ArgumentNode>,
  variableDefinitionMap: Record<string, VariableDefinitionNode>,
  variableValues: Record<string, any>
): void {
  const generateVariableName = createVariableNameGenerator(variableDefinitionMap);

  const sourceField = sourceParentType.getFields()[sourceFieldName];
  for (const argument of sourceField.args) {
    const argName = argument.name;
    const sourceArgType = argument.type;

    if (argumentNodeMap[argName] === undefined) {
      const defaultValue = argument.defaultValue;

      if (defaultValue !== undefined) {
        updateArgument(
          argumentNodeMap,
          variableDefinitionMap,
          variableValues,
          argName,
          generateVariableName(argName),
          sourceArgType,
          serializeInputValue(sourceArgType, defaultValue)
        );
      }
    }
  }
}
