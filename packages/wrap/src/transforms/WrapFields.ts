import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLError,
  FieldNode,
  FragmentDefinitionNode,
  SelectionSetNode,
  Kind,
  GraphQLFieldConfigMap,
  GraphQLFieldConfig,
  GraphQLFieldResolver,
} from 'graphql';

import {
  Request,
  appendObjectFields,
  selectObjectFields,
  modifyObjectFields,
  ExecutionResult,
  relocatedError,
  assertSome,
} from '@graphql-tools/utils';

import { Transform, defaultMergedResolver, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import MapFields from './MapFields';
import { defaultCreateProxyingResolver } from '../generateProxyingResolvers';

interface WrapFieldsTransformationContext {
  nextIndex: number;
  paths: Record<string, { pathToField: Array<string>; alias: string }>;
}

export default class WrapFields<TContext> implements Transform<WrapFieldsTransformationContext, TContext> {
  private readonly outerTypeName: string;
  private readonly wrappingFieldNames: Array<string>;
  private readonly wrappingTypeNames: Array<string>;
  private readonly numWraps: number;
  private readonly fieldNames: Array<string> | undefined;
  private readonly transformer: MapFields<TContext>;

  constructor(
    outerTypeName: string,
    wrappingFieldNames: Array<string>,
    wrappingTypeNames: Array<string>,
    fieldNames?: Array<string>,
    prefix = 'gqtld'
  ) {
    this.outerTypeName = outerTypeName;
    this.wrappingFieldNames = wrappingFieldNames;
    this.wrappingTypeNames = wrappingTypeNames;
    this.numWraps = wrappingFieldNames.length;
    this.fieldNames = fieldNames;

    const remainingWrappingFieldNames = this.wrappingFieldNames.slice();
    const outerMostWrappingFieldName = remainingWrappingFieldNames.shift();
    assertSome(outerMostWrappingFieldName);
    this.transformer = new MapFields<TContext>(
      {
        [outerTypeName]: {
          [outerMostWrappingFieldName]: (fieldNode, fragments, transformationContext) =>
            hoistFieldNodes({
              fieldNode,
              path: remainingWrappingFieldNames,
              fieldNames,
              fragments,
              transformationContext: transformationContext as WrapFieldsTransformationContext,
              prefix,
            }),
        },
      },
      {
        [outerTypeName]: (value, context) => dehoistValue(value, context as WrapFieldsTransformationContext),
      },
      (errors, context) => dehoistErrors(errors, context as WrapFieldsTransformationContext)
    );
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig<any, any, any, TContext>,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    const fieldNames = this.fieldNames;
    const targetFieldConfigMap = selectObjectFields(
      originalWrappingSchema,
      this.outerTypeName,
      !fieldNames ? () => true : fieldName => fieldNames.includes(fieldName)
    );

    const newTargetFieldConfigMap: GraphQLFieldConfigMap<any, any> = Object.create(null);
    for (const fieldName in targetFieldConfigMap) {
      const field = targetFieldConfigMap[fieldName];
      const newField: GraphQLFieldConfig<any, any> = {
        ...field,
        resolve: defaultMergedResolver,
      };
      newTargetFieldConfigMap[fieldName] = newField;
    }

    let wrapIndex = this.numWraps - 1;
    let wrappingTypeName = this.wrappingTypeNames[wrapIndex];
    let wrappingFieldName = this.wrappingFieldNames[wrapIndex];

    let newSchema = appendObjectFields(originalWrappingSchema, wrappingTypeName, newTargetFieldConfigMap);

    for (wrapIndex--; wrapIndex > -1; wrapIndex--) {
      const nextWrappingTypeName = this.wrappingTypeNames[wrapIndex];

      newSchema = appendObjectFields(newSchema, nextWrappingTypeName, {
        [wrappingFieldName]: {
          type: newSchema.getType(wrappingTypeName) as GraphQLObjectType,
          resolve: defaultMergedResolver,
        },
      });

      wrappingTypeName = nextWrappingTypeName;
      wrappingFieldName = this.wrappingFieldNames[wrapIndex];
    }

    const wrappingRootField =
      this.outerTypeName === originalWrappingSchema.getQueryType()?.name ||
      this.outerTypeName === originalWrappingSchema.getMutationType()?.name;

    let resolve: GraphQLFieldResolver<any, any> | undefined;
    if (transformedSchema) {
      if (wrappingRootField) {
        const targetSchema = subschemaConfig.schema;
        const operation = this.outerTypeName === targetSchema.getQueryType()?.name ? 'query' : 'mutation';
        const createProxyingResolver = subschemaConfig.createProxyingResolver ?? defaultCreateProxyingResolver;
        resolve = createProxyingResolver({
          subschemaConfig,
          transformedSchema,
          operation,
          fieldName: wrappingFieldName,
        });
      } else {
        resolve = defaultMergedResolver;
      }
    }

    const selectedFieldNames = Object.keys(newTargetFieldConfigMap);
    [newSchema] = modifyObjectFields(
      newSchema,
      this.outerTypeName,
      fieldName => selectedFieldNames.includes(fieldName),
      {
        [wrappingFieldName]: {
          type: newSchema.getType(wrappingTypeName) as GraphQLObjectType,
          resolve,
        },
      }
    );

    return this.transformer.transformSchema(newSchema, subschemaConfig, transformedSchema);
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    transformationContext: WrapFieldsTransformationContext
  ): Request {
    transformationContext.nextIndex = 0;
    transformationContext.paths = Object.create(null);
    return this.transformer.transformRequest(originalRequest, delegationContext, transformationContext);
  }

  public transformResult(
    originalResult: ExecutionResult,
    delegationContext: DelegationContext,
    transformationContext: WrapFieldsTransformationContext
  ): ExecutionResult {
    return this.transformer.transformResult(originalResult, delegationContext, transformationContext);
  }
}

function collectFields(
  selectionSet: SelectionSetNode | undefined,
  fragments: Record<string, FragmentDefinitionNode>,
  fields: Array<FieldNode> = [],
  visitedFragmentNames = {}
): Array<FieldNode> {
  if (selectionSet != null) {
    for (const selection of selectionSet.selections) {
      switch (selection.kind) {
        case Kind.FIELD:
          fields.push(selection);
          break;
        case Kind.INLINE_FRAGMENT:
          collectFields(selection.selectionSet, fragments, fields, visitedFragmentNames);
          break;
        case Kind.FRAGMENT_SPREAD: {
          const fragmentName = selection.name.value;
          if (!visitedFragmentNames[fragmentName]) {
            visitedFragmentNames[fragmentName] = true;
            collectFields(fragments[fragmentName].selectionSet, fragments, fields, visitedFragmentNames);
          }
          break;
        }
        default:
          // unreachable
          break;
      }
    }
  }

  return fields;
}

function aliasFieldNode(fieldNode: FieldNode, str: string): FieldNode {
  return {
    ...fieldNode,
    alias: {
      kind: Kind.NAME,
      value: str,
    },
  };
}

function hoistFieldNodes({
  fieldNode,
  fieldNames,
  path,
  fragments,
  transformationContext,
  prefix,
  index = 0,
  wrappingPath = [],
}: {
  fieldNode: FieldNode;
  fieldNames?: Array<string>;
  path: Array<string>;
  fragments: Record<string, FragmentDefinitionNode>;
  transformationContext: WrapFieldsTransformationContext;
  prefix: string;
  index?: number;
  wrappingPath?: ReadonlyArray<string>;
}): Array<FieldNode> {
  const alias = fieldNode.alias != null ? fieldNode.alias.value : fieldNode.name.value;

  let newFieldNodes: Array<FieldNode> = [];

  if (index < path.length) {
    const pathSegment = path[index];
    for (const possibleFieldNode of collectFields(fieldNode.selectionSet, fragments)) {
      if (possibleFieldNode.name.value === pathSegment) {
        const newWrappingPath = wrappingPath.concat([alias]);

        newFieldNodes = newFieldNodes.concat(
          hoistFieldNodes({
            fieldNode: possibleFieldNode,
            fieldNames,
            path,
            fragments,
            transformationContext,
            prefix,
            index: index + 1,
            wrappingPath: newWrappingPath,
          })
        );
      }
    }
  } else {
    for (const possibleFieldNode of collectFields(fieldNode.selectionSet, fragments)) {
      if (!fieldNames || fieldNames.includes(possibleFieldNode.name.value)) {
        const nextIndex = transformationContext.nextIndex;
        transformationContext.nextIndex++;
        const indexingAlias = `__${prefix}${nextIndex}__`;
        transformationContext.paths[indexingAlias] = {
          pathToField: wrappingPath.concat([alias]),
          alias: possibleFieldNode.alias != null ? possibleFieldNode.alias.value : possibleFieldNode.name.value,
        };
        newFieldNodes.push(aliasFieldNode(possibleFieldNode, indexingAlias));
      }
    }
  }

  return newFieldNodes;
}

export function dehoistValue(originalValue: any, context: WrapFieldsTransformationContext): any {
  if (originalValue == null) {
    return originalValue;
  }

  const newValue = Object.create(null);

  for (const alias in originalValue) {
    let obj = newValue;

    const path = context.paths[alias];
    if (path == null) {
      newValue[alias] = originalValue[alias];
      continue;
    }

    const pathToField = path.pathToField;
    const fieldAlias = path.alias;
    for (const key of pathToField) {
      obj = obj[key] = obj[key] || Object.create(null);
    }
    obj[fieldAlias] = originalValue[alias];
  }

  return newValue;
}

function dehoistErrors(
  errors: ReadonlyArray<GraphQLError> | undefined,
  context: WrapFieldsTransformationContext
): Array<GraphQLError> | undefined {
  if (errors === undefined) {
    return undefined;
  }

  return errors.map(error => {
    const originalPath = error.path;
    if (originalPath == null) {
      return error;
    }

    let newPath: Array<string | number> = [];
    for (const pathSegment of originalPath) {
      if (typeof pathSegment !== 'string') {
        newPath.push(pathSegment);
        continue;
      }

      const path = context.paths[pathSegment];
      if (path == null) {
        newPath.push(pathSegment);
        continue;
      }

      newPath = newPath.concat(path.pathToField, [path.alias]);
    }

    return relocatedError(error, newPath);
  });
}
