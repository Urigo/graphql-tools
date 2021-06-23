import {
  DocumentNode,
  GraphQLSchema,
  Kind,
  SelectionSetNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  GraphQLOutputType,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  SelectionNode,
  DefinitionNode,
} from 'graphql';

import { Request, collectFields, GraphQLExecutionContext, assertSome, Maybe } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '../types';

type VisitSelectionSetsVisitor = (node: SelectionSetNode, typeInfo: TypeInfo) => Maybe<SelectionSetNode>;

export default class VisitSelectionSets implements Transform {
  private readonly visitor: VisitSelectionSetsVisitor;

  constructor(visitor: VisitSelectionSetsVisitor) {
    this.visitor = visitor;
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): Request {
    const document = visitSelectionSets(
      originalRequest,
      delegationContext.info.schema,
      delegationContext.returnType,
      this.visitor
    );
    return {
      ...originalRequest,
      document,
    };
  }
}

function visitSelectionSets(
  request: Request,
  schema: GraphQLSchema,
  initialType: GraphQLOutputType,
  visitor: VisitSelectionSetsVisitor
): DocumentNode {
  const { document, variables } = request;

  const operations: Array<OperationDefinitionNode> = [];
  const fragments: Record<string, FragmentDefinitionNode> = Object.create(null);
  document.definitions.forEach(def => {
    if (def.kind === Kind.OPERATION_DEFINITION) {
      operations.push(def);
    } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments[def.name.value] = def;
    }
  });

  const partialExecutionContext = {
    schema,
    variableValues: variables,
    fragments,
  } as GraphQLExecutionContext;

  const typeInfo = new TypeInfo(schema, undefined, initialType);
  const newDefinitions: Array<DefinitionNode> = operations.map(operation => {
    const type =
      operation.operation === 'query'
        ? schema.getQueryType()
        : operation.operation === 'mutation'
        ? schema.getMutationType()
        : schema.getSubscriptionType();
    assertSome(type);

    const fields = collectFields(
      partialExecutionContext,
      type,
      operation.selectionSet,
      Object.create(null),
      Object.create(null)
    );

    const newSelections: Array<SelectionNode> = [];
    Object.keys(fields).forEach(responseKey => {
      const fieldNodes = fields[responseKey];
      fieldNodes.forEach(fieldNode => {
        const selectionSet = fieldNode.selectionSet;

        if (selectionSet == null) {
          newSelections.push(fieldNode);
          return;
        }

        const newSelectionSet = visit(
          selectionSet,
          visitWithTypeInfo(typeInfo, {
            [Kind.SELECTION_SET]: node => visitor(node, typeInfo),
          })
        );

        if (newSelectionSet === selectionSet) {
          newSelections.push(fieldNode);
          return;
        }

        newSelections.push({
          ...fieldNode,
          selectionSet: newSelectionSet,
        });
      });
    });

    return {
      ...operation,
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: newSelections,
      },
    };
  });

  Object.values(fragments).forEach(fragment => {
    newDefinitions.push(
      visit(
        fragment,
        visitWithTypeInfo(typeInfo, {
          [Kind.SELECTION_SET]: node => visitor(node, typeInfo),
        })
      )
    );
  });

  return {
    ...document,
    definitions: newDefinitions,
  };
}
