// adapted from https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-source-graphql/src/batching/merge-queries.js

import {
  visit,
  Kind,
  DefinitionNode,
  OperationDefinitionNode,
  DocumentNode,
  FragmentDefinitionNode,
  VariableDefinitionNode,
  SelectionNode,
  FragmentSpreadNode,
  VariableNode,
  VisitorKeyMap,
  ASTKindToNode,
  InlineFragmentNode,
  FieldNode,
} from 'graphql';

import { ExecutionRequest } from '@graphql-tools/utils';

import { createPrefix } from './prefix';

/**
 * Merge multiple queries into a single query in such a way that query results
 * can be split and transformed as if they were obtained by running original queries.
 *
 * Merging algorithm involves several transformations:
 *  1. Replace top-level fragment spreads with inline fragments (... on Query {})
 *  2. Add unique aliases to all top-level query fields (including those on inline fragments)
 *  3. Prefix all variable definitions and variable usages
 *  4. Prefix names (and spreads) of fragments
 *
 * i.e transform:
 *   [
 *     `query Foo($id: ID!) { foo, bar(id: $id), ...FooQuery }
 *     fragment FooQuery on Query { baz }`,
 *
 *    `query Bar($id: ID!) { foo: baz, bar(id: $id), ... on Query { baz } }`
 *   ]
 * to:
 *   query (
 *     $graphqlTools1_id: ID!
 *     $graphqlTools2_id: ID!
 *   ) {
 *     graphqlTools1_foo: foo,
 *     graphqlTools1_bar: bar(id: $graphqlTools1_id)
 *     ... on Query {
 *       graphqlTools1__baz: baz
 *     }
 *     graphqlTools1__foo: baz
 *     graphqlTools1__bar: bar(id: $graphqlTools1__id)
 *     ... on Query {
 *       graphqlTools1__baz: baz
 *     }
 *   }
 */
export function mergeRequests(
  requests: Array<ExecutionRequest>,
  extensionsReducer: (mergedExtensions: Record<string, any>, request: ExecutionRequest) => Record<string, any>
): ExecutionRequest {
  const mergedVariables: Record<string, any> = Object.create(null);
  const mergedVariableDefinitions: Array<VariableDefinitionNode> = [];
  const mergedSelections: Array<SelectionNode> = [];
  const mergedFragmentDefinitions: Array<FragmentDefinitionNode> = [];
  let mergedExtensions: Record<string, any> = Object.create(null);

  for (const index in requests) {
    const request = requests[index];
    const prefixedRequests = prefixRequest(createPrefix(index), request);

    for (const def of prefixedRequests.document.definitions) {
      if (isOperationDefinition(def)) {
        mergedSelections.push(...def.selectionSet.selections);
        if (def.variableDefinitions) {
          mergedVariableDefinitions.push(...def.variableDefinitions);
        }
      }
      if (isFragmentDefinition(def)) {
        mergedFragmentDefinitions.push(def);
      }
    }
    Object.assign(mergedVariables, prefixedRequests.variables);
    mergedExtensions = extensionsReducer(mergedExtensions, request);
  }

  const mergedOperationDefinition: OperationDefinitionNode = {
    kind: Kind.OPERATION_DEFINITION,
    operation: requests[0].operationType,
    variableDefinitions: mergedVariableDefinitions,
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: mergedSelections,
    },
  };

  return {
    document: {
      kind: Kind.DOCUMENT,
      definitions: [mergedOperationDefinition, ...mergedFragmentDefinitions],
    },
    variables: mergedVariables,
    extensions: mergedExtensions,
    context: requests[0].context,
    info: requests[0].info,
    operationType: requests[0].operationType,
  };
}

function prefixRequest(prefix: string, request: ExecutionRequest): ExecutionRequest {
  let document = aliasTopLevelFields(prefix, request.document);
  const executionVariables = request.variables ?? {};
  const variableNames = Object.keys(executionVariables);

  if (variableNames.length === 0) {
    return { ...request, document };
  }

  function prefixNode(node: VariableNode | FragmentDefinitionNode | FragmentSpreadNode) {
    return prefixNodeName(node, prefix);
  }

  document = visit(document, {
    [Kind.VARIABLE]: prefixNode,
    [Kind.FRAGMENT_DEFINITION]: prefixNode,
    [Kind.FRAGMENT_SPREAD]: prefixNode,
  });

  const prefixedVariables = variableNames.reduce((acc, name) => {
    acc[prefix + name] = executionVariables[name];
    return acc;
  }, Object.create(null));

  return {
    document,
    variables: prefixedVariables,
    operationType: request.operationType,
  };
}

/**
 * Adds prefixed aliases to top-level fields of the query.
 *
 * @see aliasFieldsInSelection for implementation details
 */
function aliasTopLevelFields(prefix: string, document: DocumentNode): DocumentNode {
  const transformer = {
    [Kind.OPERATION_DEFINITION]: (def: OperationDefinitionNode) => {
      const { selections } = def.selectionSet;
      return {
        ...def,
        selectionSet: {
          ...def.selectionSet,
          selections: aliasFieldsInSelection(prefix, selections, document),
        },
      };
    },
  };
  return visit(document, transformer, {
    [Kind.DOCUMENT]: [`definitions`],
  } as unknown as VisitorKeyMap<ASTKindToNode>);
}

/**
 * Add aliases to fields of the selection, including top-level fields of inline fragments.
 * Fragment spreads are converted to inline fragments and their top-level fields are also aliased.
 *
 * Note that this method is shallow. It adds aliases only to the top-level fields and doesn't
 * descend to field sub-selections.
 *
 * For example, transforms:
 *   {
 *     foo
 *     ... on Query { foo }
 *     ...FragmentWithBarField
 *   }
 * To:
 *   {
 *     graphqlTools1_foo: foo
 *     ... on Query { graphqlTools1_foo: foo }
 *     ... on Query { graphqlTools1_bar: bar }
 *   }
 */
function aliasFieldsInSelection(
  prefix: string,
  selections: ReadonlyArray<SelectionNode>,
  document: DocumentNode
): Array<SelectionNode> {
  return selections.map(selection => {
    switch (selection.kind) {
      case Kind.INLINE_FRAGMENT:
        return aliasFieldsInInlineFragment(prefix, selection, document);
      case Kind.FRAGMENT_SPREAD: {
        const inlineFragment = inlineFragmentSpread(selection, document);
        return aliasFieldsInInlineFragment(prefix, inlineFragment, document);
      }
      case Kind.FIELD:
      default:
        return aliasField(selection, prefix);
    }
  });
}

/**
 * Add aliases to top-level fields of the inline fragment.
 * Returns new inline fragment node.
 *
 * For Example, transforms:
 *   ... on Query { foo, ... on Query { bar: foo } }
 * To
 *   ... on Query { graphqlTools1_foo: foo, ... on Query { graphqlTools1_bar: foo } }
 */
function aliasFieldsInInlineFragment(
  prefix: string,
  fragment: InlineFragmentNode,
  document: DocumentNode
): InlineFragmentNode {
  const { selections } = fragment.selectionSet;
  return {
    ...fragment,
    selectionSet: {
      ...fragment.selectionSet,
      selections: aliasFieldsInSelection(prefix, selections, document),
    },
  };
}

/**
 * Replaces fragment spread with inline fragment
 *
 * Example:
 *   query { ...Spread }
 *   fragment Spread on Query { bar }
 *
 * Transforms to:
 *   query { ... on Query { bar } }
 */
function inlineFragmentSpread(spread: FragmentSpreadNode, document: DocumentNode): InlineFragmentNode {
  const fragment = document.definitions.find(
    def => isFragmentDefinition(def) && def.name.value === spread.name.value
  ) as FragmentDefinitionNode;
  if (!fragment) {
    throw new Error(`Fragment ${spread.name.value} does not exist`);
  }
  const { typeCondition, selectionSet } = fragment;
  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition,
    selectionSet,
    directives: spread.directives,
  };
}

function prefixNodeName<T extends VariableNode | FragmentDefinitionNode | FragmentSpreadNode>(
  namedNode: T,
  prefix: string
): T {
  return {
    ...namedNode,
    name: {
      ...namedNode.name,
      value: prefix + namedNode.name.value,
    },
  };
}

/**
 * Returns a new FieldNode with prefixed alias
 *
 * Example. Given prefix === "graphqlTools1_" transforms:
 *   { foo } -> { graphqlTools1_foo: foo }
 *   { foo: bar } -> { graphqlTools1_foo: bar }
 */
function aliasField(field: FieldNode, aliasPrefix: string): FieldNode {
  const aliasNode = field.alias ? field.alias : field.name;
  return {
    ...field,
    alias: {
      ...aliasNode,
      value: aliasPrefix + aliasNode.value,
    },
  };
}

function isOperationDefinition(def: DefinitionNode): def is OperationDefinitionNode {
  return def.kind === Kind.OPERATION_DEFINITION;
}

function isFragmentDefinition(def: DefinitionNode): def is FragmentDefinitionNode {
  return def.kind === Kind.FRAGMENT_DEFINITION;
}
