import {
  valueFromAST,
  GraphQLField,
  GraphQLDirective,
  DirectiveNode,
  FieldNode,
  isNonNullType,
  GraphQLError,
  Kind,
  print,
} from 'graphql';
import { keyMap } from './keyMap';
import { inspect } from './inspect';

/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
export function getArgumentValues(
  def: GraphQLField<any, any> | GraphQLDirective,
  node: FieldNode | DirectiveNode,
  variableValues?: { [variableName: string]: any },
): { [argument: string]: any } {
  const coercedValues = {};

  /* istanbul ignore next (See https://github.com/graphql/graphql-js/issues/2203) */
  const argumentNodes = node.arguments ?? [];
  const argNodeMap = keyMap(argumentNodes, (arg) => arg.name.value);

  for (const argDef of def.args) {
    const name = argDef.name;
    const argType = argDef.type;
    const argumentNode = argNodeMap[name];

    if (!argumentNode) {
      if (argDef.defaultValue !== undefined) {
        coercedValues[name] = argDef.defaultValue;
      } else if (isNonNullType(argType)) {
        throw new GraphQLError(
          `Argument "${name}" of required type "${inspect(argType)}" ` +
            'was not provided.',
          node,
        );
      }
      continue;
    }

    const valueNode = argumentNode.value;
    let isNull = valueNode.kind === Kind.NULL;

    if (valueNode.kind === Kind.VARIABLE) {
      const variableName = valueNode.name.value;
      if (
        variableValues == null ||
        !hasOwnProperty(variableValues, variableName)
      ) {
        if (argDef.defaultValue !== undefined) {
          coercedValues[name] = argDef.defaultValue;
        } else if (isNonNullType(argType)) {
          throw new GraphQLError(
            `Argument "${name}" of required type "${inspect(argType)}" ` +
              `was provided the variable "$${variableName}" which was not provided a runtime value.`,
            valueNode,
          );
        }
        continue;
      }
      isNull = variableValues[variableName] == null;
    }

    if (isNull && isNonNullType(argType)) {
      throw new GraphQLError(
        `Argument "${name}" of non-null type "${inspect(argType)}" ` +
          'must not be null.',
        valueNode,
      );
    }

    const coercedValue = valueFromAST(valueNode, argType, variableValues);
    if (coercedValue === undefined) {
      // Note: ValuesOfCorrectTypeRule validation should catch this before
      // execution. This is a runtime check to ensure execution does not
      // continue with an invalid argument value.
      throw new GraphQLError(
        `Argument "${name}" has invalid value ${print(valueNode)}.`,
        valueNode,
      );
    }
    coercedValues[name] = coercedValue;
  }
  return coercedValues;
}

function hasOwnProperty(obj: any, prop: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}
