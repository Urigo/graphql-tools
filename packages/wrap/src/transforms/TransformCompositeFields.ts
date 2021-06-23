import {
  GraphQLSchema,
  GraphQLType,
  DocumentNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  Kind,
  SelectionSetNode,
  SelectionNode,
  FragmentDefinitionNode,
} from 'graphql';

import { Request, MapperKind, mapSchema, visitData, ExecutionResult, Maybe, assertSome } from '@graphql-tools/utils';

import { Transform, DelegationContext, SubschemaConfig } from '@graphql-tools/delegate';

import { FieldTransformer, FieldNodeTransformer, DataTransformer, ErrorsTransformer } from '../types';

export default class TransformCompositeFields<TContext = Record<string, any>> implements Transform<any, TContext> {
  private readonly fieldTransformer: FieldTransformer;
  private readonly fieldNodeTransformer: FieldNodeTransformer | undefined;
  private readonly dataTransformer: DataTransformer | undefined;
  private readonly errorsTransformer: ErrorsTransformer | undefined;
  private transformedSchema: GraphQLSchema | undefined;
  private typeInfo: TypeInfo | undefined;
  private mapping: Record<string, Record<string, string>>;
  private subscriptionTypeName: string | undefined;

  constructor(
    fieldTransformer: FieldTransformer,
    fieldNodeTransformer?: FieldNodeTransformer,
    dataTransformer?: DataTransformer,
    errorsTransformer?: ErrorsTransformer
  ) {
    this.fieldTransformer = fieldTransformer;
    this.fieldNodeTransformer = fieldNodeTransformer;
    this.dataTransformer = dataTransformer;
    this.errorsTransformer = errorsTransformer;
    this.mapping = {};
  }

  private _getTypeInfo() {
    assertSome(this.typeInfo);
    return this.typeInfo;
  }

  public transformSchema(
    originalWrappingSchema: GraphQLSchema,
    _subschemaConfig: SubschemaConfig<any, any, any, TContext>,
    _transformedSchema?: GraphQLSchema
  ): GraphQLSchema {
    this.transformedSchema = mapSchema(originalWrappingSchema, {
      [MapperKind.COMPOSITE_FIELD]: (fieldConfig, fieldName, typeName) => {
        const transformedField = this.fieldTransformer(typeName, fieldName, fieldConfig);
        if (Array.isArray(transformedField)) {
          const newFieldName = transformedField[0];

          if (newFieldName !== fieldName) {
            if (!(typeName in this.mapping)) {
              this.mapping[typeName] = {};
            }
            this.mapping[typeName][newFieldName] = fieldName;
          }
        }
        return transformedField;
      },
    });
    this.typeInfo = new TypeInfo(this.transformedSchema);
    this.subscriptionTypeName = originalWrappingSchema.getSubscriptionType()?.name;

    return this.transformedSchema;
  }

  public transformRequest(
    originalRequest: Request,
    _delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): Request {
    const document = originalRequest.document;
    const fragments = Object.create(null);
    document.definitions.forEach(def => {
      if (def.kind === Kind.FRAGMENT_DEFINITION) {
        fragments[def.name.value] = def;
      }
    });
    return {
      ...originalRequest,
      document: this.transformDocument(document, fragments, transformationContext),
    };
  }

  public transformResult(
    result: ExecutionResult,
    _delegationContext: DelegationContext,
    transformationContext: Record<string, any>
  ): ExecutionResult {
    const dataTransformer = this.dataTransformer;
    if (dataTransformer != null) {
      result.data = visitData(result.data, value => dataTransformer(value, transformationContext));
    }
    if (this.errorsTransformer != null && Array.isArray(result.errors)) {
      result.errors = this.errorsTransformer(result.errors, transformationContext);
    }
    return result;
  }

  private transformDocument(
    document: DocumentNode,
    fragments: Record<string, FragmentDefinitionNode>,
    transformationContext: Record<string, any>
  ): DocumentNode {
    return visit(
      document,
      visitWithTypeInfo(this._getTypeInfo(), {
        leave: {
          [Kind.SELECTION_SET]: node =>
            this.transformSelectionSet(node, this._getTypeInfo(), fragments, transformationContext),
        },
      })
    );
  }

  private transformSelectionSet(
    node: SelectionSetNode,
    typeInfo: TypeInfo,
    fragments: Record<string, FragmentDefinitionNode>,
    transformationContext: Record<string, any>
  ): SelectionSetNode | undefined {
    const parentType: Maybe<GraphQLType> = typeInfo.getParentType();
    if (parentType == null) {
      return undefined;
    }

    const parentTypeName = parentType.name;
    let newSelections: Array<SelectionNode> = [];

    node.selections.forEach(selection => {
      if (selection.kind !== Kind.FIELD) {
        newSelections.push(selection);
        return;
      }

      const newName = selection.name.value;

      // See https://github.com/ardatan/graphql-tools/issues/2282
      if (
        (this.dataTransformer != null || this.errorsTransformer != null) &&
        (this.subscriptionTypeName == null || parentTypeName !== this.subscriptionTypeName)
      ) {
        newSelections.push({
          kind: Kind.FIELD,
          name: {
            kind: Kind.NAME,
            value: '__typename',
          },
        });
      }

      let transformedSelection: Maybe<SelectionNode | Array<SelectionNode>>;
      if (this.fieldNodeTransformer == null) {
        transformedSelection = selection;
      } else {
        transformedSelection = this.fieldNodeTransformer(
          parentTypeName,
          newName,
          selection,
          fragments,
          transformationContext
        );
        transformedSelection = transformedSelection === undefined ? selection : transformedSelection;
      }

      if (transformedSelection == null) {
        return;
      } else if (Array.isArray(transformedSelection)) {
        newSelections = newSelections.concat(transformedSelection);
        return;
      } else if (transformedSelection.kind !== Kind.FIELD) {
        newSelections.push(transformedSelection);
        return;
      }

      const typeMapping = this.mapping[parentTypeName];
      if (typeMapping == null) {
        newSelections.push(transformedSelection);
        return;
      }

      const oldName = this.mapping[parentTypeName][newName];
      if (oldName == null) {
        newSelections.push(transformedSelection);
        return;
      }

      newSelections.push({
        ...transformedSelection,
        name: {
          kind: Kind.NAME,
          value: oldName,
        },
        alias: {
          kind: Kind.NAME,
          value: transformedSelection.alias?.value ?? newName,
        },
      });
    });

    return {
      ...node,
      selections: newSelections,
    };
  }
}
