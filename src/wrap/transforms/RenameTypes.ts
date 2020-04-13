import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLUnionType,
  Kind,
  NamedTypeNode,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  visit,
} from 'graphql';

import { isSpecifiedScalarType, toConfig } from '../../polyfills/index';
import {
  Transform,
  Request,
  ExecutionResult,
  MapperKind,
  RenameTypesOptions,
} from '../../Interfaces';
import { mapSchema } from '../../utils/index';

export default class RenameTypes implements Transform {
  private readonly renamer: (name: string) => string | undefined;
  private map: Record<string, string>;
  private reverseMap: Record<string, string>;
  private readonly renameBuiltins: boolean;
  private readonly renameScalars: boolean;

  constructor(
    renamer: (name: string) => string | undefined,
    options?: RenameTypesOptions,
  ) {
    this.renamer = renamer;
    this.map = Object.create(null);
    this.reverseMap = Object.create(null);
    const { renameBuiltins = false, renameScalars = true } =
      options != null ? options : {};
    this.renameBuiltins = renameBuiltins;
    this.renameScalars = renameScalars;
  }

  public transformSchema(originalSchema: GraphQLSchema): GraphQLSchema {
    return mapSchema(originalSchema, {
      [MapperKind.TYPE]: (type: GraphQLNamedType) => {
        if (isSpecifiedScalarType(type) && !this.renameBuiltins) {
          return undefined;
        }
        if (isScalarType(type) && !this.renameScalars) {
          return undefined;
        }
        const oldName = type.name;
        const newName = this.renamer(oldName);
        if (newName !== undefined && newName !== oldName) {
          this.map[oldName] = newName;
          this.reverseMap[newName] = oldName;

          const newConfig = {
            ...toConfig(type),
            name: newName,
          };

          if (isObjectType(type)) {
            return new GraphQLObjectType(newConfig);
          } else if (isInterfaceType(type)) {
            return new GraphQLInterfaceType(newConfig);
          } else if (isUnionType(type)) {
            return new GraphQLUnionType(newConfig);
          } else if (isInputObjectType(type)) {
            return new GraphQLInputObjectType(newConfig);
          } else if (isEnumType(type)) {
            return new GraphQLEnumType(newConfig);
          } else if (isScalarType(type)) {
            return new GraphQLScalarType(newConfig);
          }

          throw new Error(`Unknown type ${type as string}.`);
        }
      },

      [MapperKind.ROOT_OBJECT]() {
        return undefined;
      },
    });
  }

  public transformRequest(originalRequest: Request): Request {
    const newDocument = visit(originalRequest.document, {
      [Kind.NAMED_TYPE]: (node: NamedTypeNode) => {
        const name = node.name.value;
        if (name in this.reverseMap) {
          return {
            ...node,
            name: {
              kind: Kind.NAME,
              value: this.reverseMap[name],
            },
          };
        }
      },
    });
    return {
      document: newDocument,
      variables: originalRequest.variables,
    };
  }

  public transformResult(result: ExecutionResult): ExecutionResult {
    return {
      ...result,
      data: this.transformData(result.data),
    };
  }

  private transformData(data: any): any {
    if (data == null) {
      return data;
    } else if (Array.isArray(data)) {
      return data.map((value) => this.transformData(value));
    } else if (typeof data === 'object') {
      return this.transformObject(data);
    }

    return data;
  }

  private transformObject(object: Record<string, any>): Record<string, any> {
    Object.keys(object).forEach((key) => {
      const value = object[key];
      if (key === '__typename') {
        if (value in this.map) {
          object[key] = this.map[value];
        }
      } else {
        object[key] = this.transformData(value);
      }
    });

    return object;
  }
}
