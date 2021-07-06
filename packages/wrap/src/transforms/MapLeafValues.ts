import {
  GraphQLSchema,
  visit,
  Kind,
  TypeInfo,
  visitWithTypeInfo,
  OperationDefinitionNode,
  FragmentDefinitionNode,
  VariableDefinitionNode,
  ArgumentNode,
  FieldNode,
  valueFromAST,
  isLeafType,
} from 'graphql';

import {
  Request,
  ExecutionResult,
  visitResult,
  ResultVisitorMap,
  updateArgument,
  transformInputValue,
  assertSome,
} from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import { LeafValueTransformer } from '../types';

export interface MapLeafValuesTransformationContext {
  transformedRequest: Request;
}

export default class MapLeafValues implements Transform<MapLeafValuesTransformationContext> {
  private readonly inputValueTransformer: LeafValueTransformer;
  private readonly outputValueTransformer: LeafValueTransformer;
  private readonly resultVisitorMap: ResultVisitorMap;
  private originalWrappingSchema: GraphQLSchema | undefined;
  private typeInfo: TypeInfo | undefined;

  constructor(inputValueTransformer: LeafValueTransformer, outputValueTransformer: LeafValueTransformer) {
    this.inputValueTransformer = inputValueTransformer;
    this.outputValueTransformer = outputValueTransformer;
    this.resultVisitorMap = Object.create(null);
  }

  private _getTypeInfo() {
    assertSome(this.typeInfo);
    return this.typeInfo;
  }

  private _getOriginalWrappingSchema() {
    assertSome(this.originalWrappingSchema);
    return this.originalWrappingSchema;
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    _subschemaConfig: SubschemaConfig,
    _transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    this.originalWrappingSchema = originalWrappingSchema;
    const typeMap = originalWrappingSchema.getTypeMap();
    for (const typeName in typeMap) {
      const type = typeMap[typeName];
      if (!typeName.startsWith('__')) {
        if (isLeafType(type)) {
          this.resultVisitorMap[typeName] = (value: any) => this.outputValueTransformer(typeName, value);
        }
      }
    }
    this.typeInfo = new TypeInfo(originalWrappingSchema);
    return originalWrappingSchema;
  }

  public transformRequest(
    originalRequest: Request,
    _delegationContext: DelegationContext,
    transformationContext: MapLeafValuesTransformationContext
  ): Request {
    const document = originalRequest.document;
    const variableValues = originalRequest.variables;

    const operations: Array<OperationDefinitionNode> = document.definitions.filter(
      def => def.kind === Kind.OPERATION_DEFINITION
    ) as Array<OperationDefinitionNode>;
    const fragments: Array<FragmentDefinitionNode> = document.definitions.filter(
      def => def.kind === Kind.FRAGMENT_DEFINITION
    ) as Array<FragmentDefinitionNode>;

    const newOperations = this.transformOperations(operations, variableValues);

    const transformedRequest = {
      ...originalRequest,
      document: {
        ...document,
        definitions: [...newOperations, ...fragments],
      },
      variables: variableValues,
    };

    transformationContext.transformedRequest = transformedRequest;

    return transformedRequest;
  }

  public transformResult(
    originalResult: ExecutionResult,
    _delegationContext: DelegationContext,
    transformationContext: MapLeafValuesTransformationContext
  ): ExecutionResult {
    return visitResult(
      originalResult,
      transformationContext.transformedRequest,
      this._getOriginalWrappingSchema(),
      this.resultVisitorMap
    );
  }

  private transformOperations(
    operations: Array<OperationDefinitionNode>,
    variableValues: Record<string, any>
  ): Array<OperationDefinitionNode> {
    return operations.map((operation: OperationDefinitionNode) => {
      const variableDefinitionMap: Record<string, VariableDefinitionNode> = (
        operation.variableDefinitions ?? []
      ).reduce(
        (prev, def) => ({
          ...prev,
          [def.variable.name.value]: def,
        }),
        {}
      );

      const newOperation = visit(
        operation,
        visitWithTypeInfo(this._getTypeInfo(), {
          [Kind.FIELD]: node => this.transformFieldNode(node, variableDefinitionMap, variableValues),
        })
      );

      return {
        ...newOperation,
        variableDefinitions: Object.values(variableDefinitionMap),
      };
    });
  }

  private transformFieldNode(
    field: FieldNode,
    variableDefinitionMap: Record<string, VariableDefinitionNode>,
    variableValues: Record<string, any>
  ): FieldNode | undefined {
    const targetField = this._getTypeInfo().getFieldDef();

    if (!targetField.name.startsWith('__')) {
      const argumentNodes = field.arguments;
      if (argumentNodes != null) {
        const argumentNodeMap: Record<string, ArgumentNode> = argumentNodes.reduce(
          (prev, argument) => ({
            ...prev,
            [argument.name.value]: argument,
          }),
          Object.create(null)
        );

        for (const argument of targetField.args) {
          const argName = argument.name;
          const argType = argument.type;

          const argumentNode = argumentNodeMap[argName];
          const argValue = argumentNode?.value;

          let value: any;
          if (argValue != null) {
            value = valueFromAST(argValue, argType, variableValues);
          }

          updateArgument(
            argName,
            argType,
            argumentNodeMap,
            variableDefinitionMap,
            variableValues,
            transformInputValue(argType, value, (t, v) => {
              const newValue = this.inputValueTransformer(t.name, v);
              return newValue === undefined ? v : newValue;
            })
          );
        }

        return {
          ...field,
          arguments: Object.values(argumentNodeMap),
        };
      }
    }
  }
}
