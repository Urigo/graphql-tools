import {
  getDescription,
  StringValueNode,
  FieldDefinitionNode,
  ASTNode,
  NameNode,
  TypeNode,
  visit,
  VisitFn,
} from 'graphql';
import { NamedDefinitionNode } from './merge-nodes';

let commentsRegistry: {
  [path: string]: string[];
} = {};

export function resetComments(): void {
  commentsRegistry = {};
}

export function collectComment(node: NamedDefinitionNode): void {
  const entityName = node.name?.value;
  if (entityName == null) {
    return;
  }

  pushComment(node, entityName);

  switch (node.kind) {
    case 'EnumTypeDefinition':
      if (node.values) {
        for (const value of node.values) {
          pushComment(value, entityName, value.name.value);
        }
      }
      break;

    case 'ObjectTypeDefinition':
    case 'InputObjectTypeDefinition':
    case 'InterfaceTypeDefinition':
      if (node.fields) {
        for (const field of node.fields) {
          pushComment(field, entityName, field.name.value);

          if (isFieldDefinitionNode(field) && field.arguments) {
            for (const arg of field.arguments) {
              pushComment(arg, entityName, field.name.value, arg.name.value);
            }
          }
        }
      }
      break;
  }
}

export function pushComment(node: any, entity: string, field?: string, argument?: string): void {
  const comment = getDescription(node, { commentDescriptions: true });

  if (typeof comment !== 'string' || comment.length === 0) {
    return;
  }

  const keys = [entity];

  if (field) {
    keys.push(field);

    if (argument) {
      keys.push(argument);
    }
  }

  const path = keys.join('.');

  if (!commentsRegistry[path]) {
    commentsRegistry[path] = [];
  }

  commentsRegistry[path].push(comment);
}

export function printComment(comment: string): string {
  return '\n# ' + comment.replace(/\n/g, '\n# ');
}

/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * NOTE: ==> This file has been modified just to add comments to the printed AST
 * This is a temp measure, we will move to using the original non modified printer.js ASAP.
 */

// import { visit, VisitFn } from 'graphql';

/**
 * Given maybeArray, print an empty string if it is null or empty, otherwise
 * print all items together separated by separator if provided
 */
function join(maybeArray?: readonly any[], separator?: string) {
  return maybeArray ? maybeArray.filter(x => x).join(separator || '') : '';
}

function addDescription(cb: VisitFn<any, any>): VisitFn<any, any> {
  return (
    node: { description?: StringValueNode; name: NameNode; type?: TypeNode; kind: string },
    _key,
    _parent,
    path,
    ancestors
  ) => {
    const keys: string[] = [];
    const parent = path.reduce((prev, key) => {
      if (['fields', 'arguments', 'values'].includes(key as any)) {
        keys.push(prev.name.value);
      }

      return prev[key];
    }, ancestors[0]);

    const key = [...keys, parent.name.value].join('.');
    const items: string[] = [];

    if (commentsRegistry[key]) {
      items.push(...commentsRegistry[key]);
    }

    return join([...items.map(printComment), node.description, (cb as any)(node)], '\n');
  };
}

function indent(maybeString?: string) {
  return maybeString && `  ${maybeString.replace(/\n/g, '\n  ')}`;
}

/**
 * Given array, print each item on its own line, wrapped in an
 * indented "{ }" block.
 */
function block(array?: readonly any[]) {
  return array && array.length !== 0 ? `{\n${indent(join(array, '\n'))}\n}` : '';
}

/**
 * If maybeString is not null or empty, then wrap with start and end, otherwise
 * print an empty string.
 */
function wrap(start: string, maybeString: any, end?: string) {
  return maybeString ? start + maybeString + (end || '') : '';
}

/**
 * Print a block string in the indented block form by adding a leading and
 * trailing blank line. However, if a block string starts with whitespace and is
 * a single-line, adding a leading blank line would strip that whitespace.
 */
function printBlockString(value: string, isDescription: boolean) {
  const escaped = value.replace(/"""/g, '\\"""');
  return (value[0] === ' ' || value[0] === '\t') && value.indexOf('\n') === -1
    ? `"""${escaped.replace(/"$/, '"\n')}"""`
    : `"""\n${isDescription ? escaped : indent(escaped)}\n"""`;
}

/**
 * Converts an AST into a string, using one set of reasonable
 * formatting rules.
 */
export function printWithComments(ast: ASTNode) {
  return visit(ast, {
    leave: {
      Name: node => node.value,
      Variable: node => `$${node.name}`,

      // Document

      Document: node =>
        `${node.definitions
          .map(defNode => `${defNode}\n${defNode[0] === '#' ? '' : '\n'}`)
          .join('')
          .trim()}\n`,

      OperationTypeDefinition: node => `${node.operation}: ${node.type}`,

      VariableDefinition: ({ variable, type, defaultValue }) => `${variable}: ${type}${wrap(' = ', defaultValue)}`,

      SelectionSet: ({ selections }) => block(selections),

      Field: ({ alias, name, arguments: args, directives, selectionSet }) =>
        join(
          [wrap('', alias, ': ') + name + wrap('(', join(args, ', '), ')'), join(directives, ' '), selectionSet],
          '  '
        ),

      Argument: addDescription(({ name, value }) => `${name}: ${value}`),

      // Value

      IntValue: ({ value }) => value,
      FloatValue: ({ value }) => value,
      StringValue: ({ value, block: isBlockString }, key) =>
        isBlockString ? printBlockString(value, key === 'description') : JSON.stringify(value),
      BooleanValue: ({ value }) => (value ? 'true' : 'false'),
      NullValue: () => 'null',
      EnumValue: ({ value }) => value,
      ListValue: ({ values }) => `[${join(values, ', ')}]`,
      ObjectValue: ({ fields }) => `{${join(fields, ', ')}}`,
      ObjectField: ({ name, value }) => `${name}: ${value}`,

      // Directive

      Directive: ({ name, arguments: args }) => `@${name}${wrap('(', join(args, ', '), ')')}`,

      // Type

      NamedType: ({ name }) => name,
      ListType: ({ type }) => `[${type}]`,
      NonNullType: ({ type }) => `${type}!`,

      // Type System Definitions

      SchemaDefinition: ({ directives, operationTypes }) =>
        join(['schema', join(directives, ' '), block(operationTypes)], ' '),

      ScalarTypeDefinition: addDescription(({ name, directives }) =>
        join(['scalar', name, join(directives, ' ')], ' ')
      ),

      ObjectTypeDefinition: addDescription(({ name, interfaces, directives, fields }) =>
        join(['type', name, wrap('implements ', join(interfaces, ' & ')), join(directives, ' '), block(fields)], ' ')
      ),

      FieldDefinition: addDescription(
        ({ name, arguments: args, type, directives }) =>
          `${name + wrap('(', join(args, ', '), ')')}: ${type}${wrap(' ', join(directives, ' '))}`
      ),

      InputValueDefinition: addDescription(({ name, type, defaultValue, directives }) =>
        join([`${name}: ${type}`, wrap('= ', defaultValue), join(directives, ' ')], ' ')
      ),

      InterfaceTypeDefinition: addDescription(({ name, directives, fields }) =>
        join(['interface', name, join(directives, ' '), block(fields)], ' ')
      ),

      UnionTypeDefinition: addDescription(({ name, directives, types }) =>
        join(['union', name, join(directives, ' '), types && types.length !== 0 ? `= ${join(types, ' | ')}` : ''], ' ')
      ),

      EnumTypeDefinition: addDescription(({ name, directives, values }) =>
        join(['enum', name, join(directives, ' '), block(values)], ' ')
      ),

      EnumValueDefinition: addDescription(({ name, directives }) => join([name, join(directives, ' ')], ' ')),

      InputObjectTypeDefinition: addDescription(({ name, directives, fields }) =>
        join(['input', name, join(directives, ' '), block(fields)], ' ')
      ),

      ScalarTypeExtension: ({ name, directives }) => join(['extend scalar', name, join(directives, ' ')], ' '),

      ObjectTypeExtension: ({ name, interfaces, directives, fields }) =>
        join(
          ['extend type', name, wrap('implements ', join(interfaces, ' & ')), join(directives, ' '), block(fields)],
          ' '
        ),

      InterfaceTypeExtension: ({ name, directives, fields }) =>
        join(['extend interface', name, join(directives, ' '), block(fields)], ' '),

      UnionTypeExtension: ({ name, directives, types }) =>
        join(
          ['extend union', name, join(directives, ' '), types && types.length !== 0 ? `= ${join(types, ' | ')}` : ''],
          ' '
        ),

      EnumTypeExtension: ({ name, directives, values }) =>
        join(['extend enum', name, join(directives, ' '), block(values)], ' '),

      InputObjectTypeExtension: ({ name, directives, fields }) =>
        join(['extend input', name, join(directives, ' '), block(fields)], ' '),

      DirectiveDefinition: addDescription(
        ({ name, arguments: args, locations }) =>
          `directive @${name}${wrap('(', join(args, ', '), ')')} on ${join(locations, ' | ')}`
      ),
    },
  });
}

function isFieldDefinitionNode(node: any): node is FieldDefinitionNode {
  return node.kind === 'FieldDefinition';
}
