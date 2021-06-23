import { assertSome, parseSelectionSet } from '@graphql-tools/utils';
import { FieldNode, SelectionNode, IntValueNode, ValueNode,  } from 'graphql';
import { forwardArgsToSelectionSet } from '../src';

function assertIntValueNode(input: ValueNode): asserts input is IntValueNode {
 if (input.kind !== "IntValue"){
   throw new Error(`Expected "StringValue", got "${input.kind}".`)
 }
}

function assertFieldNode(input: SelectionNode): asserts input is FieldNode {
    if (input.kind !== "Field"){
      throw new Error(`Expected "SelectionNode", got "${input.kind}".`)
    }
}

describe('forwardArgsToSelectionSet', () => {
  // TODO: assert this
  const GATEWAY_FIELD = parseSelectionSet('{ posts(pageNumber: 1, perPage: 7) }').selections[0];
  assertFieldNode(GATEWAY_FIELD)

  test('passes all arguments to a hint selection set', () => {
    const buildSelectionSet = forwardArgsToSelectionSet('{ postIds }');
    const result = buildSelectionSet(GATEWAY_FIELD).selections[0];
    assertFieldNode(result)
    expect(result.name.value).toEqual('postIds');
    assertSome(result.arguments)
    expect(result.arguments.length).toEqual(2);
    expect(result.arguments[0].name.value).toEqual('pageNumber');
    assertIntValueNode(result.arguments[0].value)
    expect(result.arguments[0].value.value).toEqual('1');
    expect(result.arguments[1].name.value).toEqual('perPage');
    assertIntValueNode(result.arguments[1].value)
    expect(result.arguments[1].value.value).toEqual('7');
  });

  test('passes mapped arguments to a hint selection set', () => {
    const buildSelectionSet = forwardArgsToSelectionSet('{ id postIds }', { postIds: ['pageNumber'] });
    const result = buildSelectionSet(GATEWAY_FIELD);

    expect(result.selections.length).toEqual(2);
    assertFieldNode(result.selections[0])
    expect(result.selections[0].name.value).toEqual('id');
    assertSome(result.selections[0].arguments)
    expect(result.selections[0].arguments.length).toEqual(0);
    assertFieldNode(result.selections[1])
    expect(result.selections[1].name.value).toEqual('postIds');
    assertSome(result.selections[1].arguments)
    expect(result.selections[1].arguments.length).toEqual(1);
    expect(result.selections[1].arguments[0].name.value).toEqual('pageNumber');
    assertIntValueNode(result.selections[1].arguments[0].value)
    expect(result.selections[1].arguments[0].value.value).toEqual('1');
  });
});
