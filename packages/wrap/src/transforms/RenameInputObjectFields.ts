import { GraphQLSchema, GraphQLInputFieldConfig, ObjectFieldNode } from 'graphql';

import { Request, mapSchema, MapperKind } from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import TransformInputObjectFields from './TransformInputObjectFields';

type RenamerFunction = (
  typeName: string,
  fieldName: string,
  inputFieldConfig: GraphQLInputFieldConfig
) => string | undefined;

export default class RenameInputObjectFields implements Transform {
  private readonly renamer: RenamerFunction;
  private readonly transformer: TransformInputObjectFields;
  private reverseMap: Record<string, Record<string, string>>;

  constructor(renamer: RenamerFunction) {
    this.renamer = renamer;
    this.transformer = new TransformInputObjectFields(
      (typeName, inputFieldName, inputFieldConfig) => {
        const newName = renamer(typeName, inputFieldName, inputFieldConfig);
        if (newName !== undefined && newName !== inputFieldName) {
          const value = renamer(typeName, inputFieldName, inputFieldConfig);
          if (value != null) {
            return [value, inputFieldConfig];
          }
        }
      },
      (typeName: string, inputFieldName: string, inputFieldNode: ObjectFieldNode) => {
        if (!(typeName in this.reverseMap)) {
          return inputFieldNode;
        }

        const inputFieldNameMap = this.reverseMap[typeName];
        if (!(inputFieldName in inputFieldNameMap)) {
          return inputFieldNode;
        }

        return {
          ...inputFieldNode,
          name: {
            ...inputFieldNode.name,
            value: inputFieldNameMap[inputFieldName],
          },
        };
      }
    );
    this.reverseMap = Object.create(null);
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    subschemaConfig: SubschemaConfig,
    transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    mapSchema(originalWrappingSchema, {
      [MapperKind.INPUT_OBJECT_FIELD]: (
        inputFieldConfig: GraphQLInputFieldConfig,
        fieldName: string,
        typeName
      ): undefined => {
        const newName = this.renamer(typeName, fieldName, inputFieldConfig);
        if (newName !== undefined && newName !== fieldName) {
          if (this.reverseMap[typeName] == null) {
            this.reverseMap[typeName] = Object.create(null);
          }
          this.reverseMap[typeName][newName] = fieldName;
        }
        return undefined;
      },

      [MapperKind.ROOT_OBJECT]() {
        return undefined;
      },
    });

    return this.transformer.transformSchema(originalWrappingSchema, subschemaConfig, transformedSchema);
  }

  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): Request {
    return this.transformer.transformRequest(originalRequest, delegationContext, transformationContext);
  }
}
