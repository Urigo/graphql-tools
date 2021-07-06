import {
  GraphQLSchema,
  DocumentNode,
  typeFromAST,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  Kind,
  FragmentDefinitionNode,
  GraphQLInputObjectType,
  ObjectValueNode,
  ObjectFieldNode,
  OperationDefinitionNode,
  isInputType,
} from 'graphql';

import { Maybe, Request, MapperKind, mapSchema, transformInputValue, assertSome } from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import { InputFieldTransformer, InputFieldNodeTransformer, InputObjectNodeTransformer } from '../types';

export default class TransformInputObjectFields implements Transform {
  private readonly inputFieldTransformer: InputFieldTransformer;
  private readonly inputFieldNodeTransformer: InputFieldNodeTransformer | undefined;
  private readonly inputObjectNodeTransformer: InputObjectNodeTransformer | undefined;
  private transformedSchema: GraphQLSchema | undefined;
  private mapping: Record<string, Record<string, string>>;

  constructor(
    inputFieldTransformer: InputFieldTransformer,
    inputFieldNodeTransformer?: InputFieldNodeTransformer,
    inputObjectNodeTransformer?: InputObjectNodeTransformer
  ) {
    this.inputFieldTransformer = inputFieldTransformer;
    this.inputFieldNodeTransformer = inputFieldNodeTransformer;
    this.inputObjectNodeTransformer = inputObjectNodeTransformer;
    this.mapping = {};
  }

  private _getTransformedSchema() {
    assertSome(this.transformedSchema);
    return this.transformedSchema;
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    _subschemaConfig: SubschemaConfig,
    _transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    this.transformedSchema = mapSchema(originalWrappingSchema, {
      [MapperKind.INPUT_OBJECT_FIELD]: (inputFieldConfig, fieldName, typeName) => {
        const transformedInputField = this.inputFieldTransformer(typeName, fieldName, inputFieldConfig);
        if (Array.isArray(transformedInputField)) {
          const newFieldName = transformedInputField[0];

          if (newFieldName !== fieldName) {
            if (!(typeName in this.mapping)) {
              this.mapping[typeName] = {};
            }
            this.mapping[typeName][newFieldName] = fieldName;
          }
        }
        return transformedInputField;
      },
    });

    return this.transformedSchema;
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): Request {
    const variableValues = originalRequest.variables;
    const fragments = Object.create(null);

    const operations: Array<OperationDefinitionNode> = [];

    for (const def of originalRequest.document.definitions) {
      if (def.kind === Kind.OPERATION_DEFINITION) {
        operations.push(def);
      } else if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      }
    }

    for (const def of operations) {
      const variableDefs = def.variableDefinitions;
      if (variableDefs != null) {
        for (const variableDef of variableDefs) {
          const varName = variableDef.variable.name.value;
          if (variableDef.type.kind !== Kind.NAMED_TYPE) {
            throw new Error(`Expected ${variableDef.type} to be a named type`);
          }
          // requirement for 'as NamedTypeNode' appears to be a bug within types, as function should take any TypeNode
          const varType = typeFromAST(delegationContext.transformedSchema, variableDef.type);
          if (!isInputType(varType)) {
            throw new Error(`Expected ${varType} to be an input type`);
          }
          variableValues[varName] = transformInputValue(
            varType,
            variableValues[varName],
            undefined,
            (type, originalValue) => {
              const newValue = Object.create(null);
              const fields = type.getFields();
              for (const key in originalValue) {
                const field = fields[key];
                if (field != null) {
                  const newFieldName = this.mapping[type.name]?.[field.name];
                  if (newFieldName != null) {
                    newValue[newFieldName] = originalValue[field.name];
                  } else {
                    newValue[field.name] = originalValue[field.name];
                  }
                }
              }
              return newValue;
            }
          );
        }
      }
    }

    for (const def of originalRequest.document.definitions.filter(def => def.kind === Kind.FRAGMENT_DEFINITION)) {
      fragments[(def as FragmentDefinitionNode).name.value] = def;
    }
    const document = this.transformDocument(
      originalRequest.document,
      this.mapping,
      this.inputFieldNodeTransformer,
      this.inputObjectNodeTransformer,
      originalRequest,
      delegationContext
    );
    return {
      ...originalRequest,
      document,
      variables: variableValues,
    };
  }

  private transformDocument(
    document: DocumentNode,
    mapping: Record<string, Record<string, string>>,
    inputFieldNodeTransformer: InputFieldNodeTransformer | undefined,
    inputObjectNodeTransformer: InputObjectNodeTransformer | undefined,
    request: Request,
    delegationContext?: DelegationContext
  ): DocumentNode {
    const typeInfo = new TypeInfo(this._getTransformedSchema());
    const newDocument: DocumentNode = visit(
      document,
      visitWithTypeInfo(typeInfo, {
        leave: {
          [Kind.OBJECT]: (node: ObjectValueNode): ObjectValueNode | undefined => {
            // The casting is kind of legit here as we are in a visitor
            const parentType = typeInfo.getInputType() as Maybe<GraphQLInputObjectType>;
            if (parentType != null) {
              const parentTypeName = parentType.name;
              const newInputFields: Array<ObjectFieldNode> = [];

              for (const inputField of node.fields) {
                const newName = inputField.name.value;

                const transformedInputField =
                  inputFieldNodeTransformer != null
                    ? inputFieldNodeTransformer(parentTypeName, newName, inputField, request, delegationContext)
                    : inputField;

                if (Array.isArray(transformedInputField)) {
                  for (const individualTransformedInputField of transformedInputField) {
                    const typeMapping = mapping[parentTypeName];
                    if (typeMapping == null) {
                      newInputFields.push(individualTransformedInputField);
                      continue;
                    }

                    const oldName = typeMapping[newName];
                    if (oldName == null) {
                      newInputFields.push(individualTransformedInputField);
                      continue;
                    }

                    newInputFields.push({
                      ...individualTransformedInputField,
                      name: {
                        ...individualTransformedInputField.name,
                        value: oldName,
                      },
                    });
                  }
                  continue;
                }

                const typeMapping = mapping[parentTypeName];
                if (typeMapping == null) {
                  newInputFields.push(transformedInputField);
                  continue;
                }

                const oldName = typeMapping[newName];
                if (oldName == null) {
                  newInputFields.push(transformedInputField);
                  continue;
                }

                newInputFields.push({
                  ...transformedInputField,
                  name: {
                    ...transformedInputField.name,
                    value: oldName,
                  },
                });
              }

              const newNode = {
                ...node,
                fields: newInputFields,
              };

              return inputObjectNodeTransformer != null
                ? inputObjectNodeTransformer(parentTypeName, newNode, request, delegationContext)
                : newNode;
            }
          },
        },
      })
    );
    return newDocument;
  }
}
