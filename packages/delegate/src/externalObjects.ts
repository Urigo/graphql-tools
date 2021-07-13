import { GraphQLSchema, GraphQLError, GraphQLObjectType, SelectionSetNode, locatedError } from 'graphql';

import { relocatedError } from '@graphql-tools/utils';

import { SubschemaConfig, ExternalObject } from './types';
import { OBJECT_SUBSCHEMA_SYMBOL, FIELD_SUBSCHEMA_MAP_SYMBOL, UNPATHED_ERRORS_SYMBOL } from './symbols';
import { collectFields, ExecutionContext } from 'graphql/execution/execute.js';

export function isExternalObject(data: any): data is ExternalObject {
  return data[UNPATHED_ERRORS_SYMBOL] !== undefined;
}

export function annotateExternalObject(
  object: any,
  errors: Array<GraphQLError>,
  subschema: GraphQLSchema | SubschemaConfig | undefined
): ExternalObject {
  Object.defineProperties(object, {
    [OBJECT_SUBSCHEMA_SYMBOL]: { value: subschema },
    [FIELD_SUBSCHEMA_MAP_SYMBOL]: { value: Object.create(null) },
    [UNPATHED_ERRORS_SYMBOL]: { value: errors },
  });
  return object;
}

export function getSubschema(object: ExternalObject, responseKey: string): GraphQLSchema | SubschemaConfig {
  return object[FIELD_SUBSCHEMA_MAP_SYMBOL][responseKey] ?? object[OBJECT_SUBSCHEMA_SYMBOL];
}

export function getUnpathedErrors(object: ExternalObject): Array<GraphQLError> {
  return object[UNPATHED_ERRORS_SYMBOL];
}

export async function mergeExternalObjects(
  schema: GraphQLSchema,
  path: Array<string | number>,
  typeName: string,
  target: ExternalObject,
  sources: Array<ExternalObject>,
  selectionSets: Array<SelectionSetNode>
): Promise<ExternalObject> {
  const results: Array<any> = [];
  let errors: Array<GraphQLError> = [];

  const type = schema.getType(typeName) as GraphQLObjectType;
  await Promise.all(
    sources.map(async (source, index) => {
      if (source instanceof Error || source === null) {
        const selectionSet = selectionSets[index];
        const fieldNodes = collectFields(
          {
            schema,
            variableValues: {},
            fragments: {},
          } as ExecutionContext,
          type,
          selectionSet,
          Object.create(null),
          Object.create(null)
        );
        const nullResult = {};
        await Promise.all(
          Object.keys(fieldNodes).map(async responseKey => {
            if (source instanceof GraphQLError) {
              nullResult[responseKey] = relocatedError(source, path.concat([responseKey]));
            } else if (source instanceof Error) {
              nullResult[responseKey] = locatedError(source, fieldNodes[responseKey], path.concat([responseKey]));
            } else {
              nullResult[responseKey] = null;
            }
          })
        );
        results.push(nullResult);
      } else {
        errors = errors.concat(source[UNPATHED_ERRORS_SYMBOL]);
        results.push(source);
      }
    })
  );

  const combinedResult: ExternalObject = Object.assign({}, target, ...results);

  const newFieldSubschemaMap = target[FIELD_SUBSCHEMA_MAP_SYMBOL] ?? Object.create(null);
  await Promise.all(
    results.map(async source => {
      const objectSubschema = source[OBJECT_SUBSCHEMA_SYMBOL];
      const fieldSubschemaMap = source[FIELD_SUBSCHEMA_MAP_SYMBOL];
      await Promise.all(
        Object.keys(source).map(async responseKey => {
          newFieldSubschemaMap[responseKey] = fieldSubschemaMap?.[responseKey] ?? objectSubschema;
        })
      );
    })
  );

  combinedResult[FIELD_SUBSCHEMA_MAP_SYMBOL] = newFieldSubschemaMap;
  combinedResult[OBJECT_SUBSCHEMA_SYMBOL] = target[OBJECT_SUBSCHEMA_SYMBOL];
  combinedResult[UNPATHED_ERRORS_SYMBOL] = target[UNPATHED_ERRORS_SYMBOL].concat(errors);

  return combinedResult;
}
