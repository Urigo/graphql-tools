import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLNamedType,
  GraphQLSchema,
  Kind,
  SelectionNode,
  SelectionSetNode,
  TypeInfo,
  getNamedType,
  isAbstractType,
  isInterfaceType,
  visit,
  visitWithTypeInfo,
  InlineFragmentNode,
  GraphQLOutputType,
  isObjectType,
  FieldNode,
} from 'graphql';

import { implementsAbstractType, getRootTypeNames } from '@graphql-tools/utils';

import { DelegationContext } from './types';
import { memoize2 } from './memoize';
import { getDocumentMetadata } from './getDocumentMetadata';

export function prepareGatewayDocument(
  originalDocument: DocumentNode,
  delegationContext: DelegationContext
): DocumentNode {
  const { info, transformedSchema, returnType } = delegationContext;
  const wrappedConcreteTypesDocument = wrapConcreteTypes(returnType, transformedSchema, originalDocument);

  if (info == null) {
    return wrappedConcreteTypesDocument;
  }

  const {
    possibleTypesMap,
    reversePossibleTypesMap,
    interfaceExtensionsMap,
    fieldNodesByType,
    fieldNodesByField,
    dynamicSelectionSetsByField,
  } = getSchemaMetaData(info.schema, transformedSchema);

  const { operations, fragments, fragmentNames } = getDocumentMetadata(wrappedConcreteTypesDocument);

  const { expandedFragments, fragmentReplacements } = getExpandedFragments(fragments, fragmentNames, possibleTypesMap);

  const typeInfo = new TypeInfo(transformedSchema);

  const expandedDocument = {
    kind: Kind.DOCUMENT,
    definitions: [...operations, ...fragments, ...expandedFragments],
  };

  return visit(
    expandedDocument,
    visitWithTypeInfo(typeInfo, {
      [Kind.SELECTION_SET]: node =>
        visitSelectionSet(
          node,
          fragmentReplacements,
          transformedSchema,
          typeInfo,
          possibleTypesMap,
          reversePossibleTypesMap,
          interfaceExtensionsMap,
          fieldNodesByType,
          fieldNodesByField,
          dynamicSelectionSetsByField
        ),
    }),
    // visitorKeys argument usage a la https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-source-graphql/src/batching/merge-queries.js
    // empty keys cannot be removed only because of typescript errors
    // will hopefully be fixed in future version of graphql-js to be optional
    {
      Name: [],

      Document: ['definitions'],
      OperationDefinition: ['selectionSet'],
      VariableDefinition: [],
      Variable: [],
      SelectionSet: ['selections'],
      Field: ['selectionSet'],
      Argument: [],

      FragmentSpread: [],
      InlineFragment: ['selectionSet'],
      FragmentDefinition: ['selectionSet'],

      IntValue: [],
      FloatValue: [],
      StringValue: [],
      BooleanValue: [],
      NullValue: [],
      EnumValue: [],
      ListValue: [],
      ObjectValue: [],
      ObjectField: [],

      Directive: [],

      NamedType: [],
      ListType: [],
      NonNullType: [],

      SchemaDefinition: [],
      OperationTypeDefinition: [],

      ScalarTypeDefinition: [],
      ObjectTypeDefinition: [],
      FieldDefinition: [],
      InputValueDefinition: [],
      InterfaceTypeDefinition: [],
      UnionTypeDefinition: [],
      EnumTypeDefinition: [],
      EnumValueDefinition: [],
      InputObjectTypeDefinition: [],

      DirectiveDefinition: [],

      SchemaExtension: [],

      ScalarTypeExtension: [],
      ObjectTypeExtension: [],
      InterfaceTypeExtension: [],
      UnionTypeExtension: [],
      EnumTypeExtension: [],
      InputObjectTypeExtension: [],
    }
  );
}

function visitSelectionSet(
  node: SelectionSetNode,
  fragmentReplacements: Record<string, Array<{ fragmentName: string; typeName: string }>>,
  schema: GraphQLSchema,
  typeInfo: TypeInfo,
  possibleTypesMap: Record<string, Array<string>>,
  reversePossibleTypesMap: Record<string, Array<string>>,
  interfaceExtensionsMap: Record<string, Record<string, boolean>>,
  fieldNodesByType: Record<string, Array<FieldNode>>,
  fieldNodesByField: Record<string, Record<string, Array<FieldNode>>>,
  dynamicSelectionSetsByField: Record<string, Record<string, Array<(node: FieldNode) => SelectionSetNode>>>
): SelectionSetNode {
  const newSelections: Array<SelectionNode> = [];
  const maybeType = typeInfo.getParentType();

  if (maybeType != null) {
    const parentType: GraphQLNamedType = getNamedType(maybeType);
    const uniqueSelections: Set<SelectionNode> = new Set();
    const parentTypeName = parentType.name;

    const fieldNodes = fieldNodesByType[parentTypeName];
    if (fieldNodes) {
      addSelectionsToSet(uniqueSelections, fieldNodes);
    }

    const interfaceExtensions = interfaceExtensionsMap[parentType.name];
    const interfaceExtensionFields: Array<SelectionNode> = [];

    for (const selection of node.selections) {
      if (selection.kind === Kind.INLINE_FRAGMENT) {
        if (selection.typeCondition != null) {
          const possibleTypes = possibleTypesMap[selection.typeCondition.name.value];

          if (possibleTypes == null) {
            newSelections.push(selection);
            continue;
          }

          for (const possibleTypeName of possibleTypes) {
            const maybePossibleType = schema.getType(possibleTypeName);
            if (maybePossibleType != null && implementsAbstractType(schema, parentType, maybePossibleType)) {
              newSelections.push(generateInlineFragment(possibleTypeName, selection.selectionSet));
            }
          }
        }
      } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const fragmentName = selection.name.value;

        if (!(fragmentName in fragmentReplacements)) {
          newSelections.push(selection);
          continue;
        }

        for (const replacement of fragmentReplacements[fragmentName]) {
          const typeName = replacement.typeName;
          const maybeReplacementType = schema.getType(typeName);

          if (maybeReplacementType != null && implementsAbstractType(schema, parentType, maybeType)) {
            newSelections.push({
              kind: Kind.FRAGMENT_SPREAD,
              name: {
                kind: Kind.NAME,
                value: replacement.fragmentName,
              },
            });
          }
        }
      } else {
        const fieldName = selection.name.value;

        const fieldNodes = fieldNodesByField[parentTypeName]?.[fieldName];
        if (fieldNodes != null) {
          addSelectionsToSet(uniqueSelections, fieldNodes);
        }

        const dynamicSelectionSets = dynamicSelectionSetsByField[parentTypeName]?.[fieldName];
        if (dynamicSelectionSets != null) {
          for (const selectionSetFn of dynamicSelectionSets) {
            const selectionSet = selectionSetFn(selection);
            if (selectionSet != null) {
              addSelectionsToSet(uniqueSelections, selectionSet.selections);
            }
          }
        }

        if (interfaceExtensions?.[fieldName]) {
          interfaceExtensionFields.push(selection);
        } else {
          newSelections.push(selection);
        }
      }
    }

    if (parentType.name in reversePossibleTypesMap) {
      newSelections.push({
        kind: Kind.FIELD,
        name: {
          kind: Kind.NAME,
          value: '__typename',
        },
      });
    }

    if (interfaceExtensionFields.length) {
      const possibleTypes = possibleTypesMap[parentType.name];
      if (possibleTypes != null) {
        for (const possibleType of possibleTypes) {
          newSelections.push(
            generateInlineFragment(possibleType, {
              kind: Kind.SELECTION_SET,
              selections: interfaceExtensionFields,
            })
          );
        }
      }
    }

    return {
      ...node,
      selections: newSelections.concat(Array.from(uniqueSelections)),
    };
  }

  return node;
}

function generateInlineFragment(typeName: string, selectionSet: SelectionSetNode): InlineFragmentNode {
  return {
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: {
      kind: Kind.NAMED_TYPE,
      name: {
        kind: Kind.NAME,
        value: typeName,
      },
    },
    selectionSet,
  };
}

const getSchemaMetaData = memoize2(
  (
    sourceSchema: GraphQLSchema,
    targetSchema: GraphQLSchema
  ): {
    possibleTypesMap: Record<string, Array<string>>;
    reversePossibleTypesMap: Record<string, Array<string>>;
    interfaceExtensionsMap: Record<string, Record<string, boolean>>;
    fieldNodesByType: Record<string, Array<FieldNode>>;
    fieldNodesByField: Record<string, Record<string, Array<FieldNode>>>;
    dynamicSelectionSetsByField: Record<string, Record<string, Array<(node: FieldNode) => SelectionSetNode>>>;
  } => {
    const typeMap = sourceSchema.getTypeMap();
    const targetTypeMap = targetSchema.getTypeMap();
    const possibleTypesMap: Record<string, Array<string>> = Object.create(null);
    const interfaceExtensionsMap: Record<string, Record<string, boolean>> = Object.create(null);

    for (const typeName in typeMap) {
      const type = typeMap[typeName];

      if (isAbstractType(type)) {
        const targetType = targetTypeMap[typeName];

        if (isInterfaceType(type) && isInterfaceType(targetType)) {
          const targetTypeFields = targetType.getFields();
          const sourceTypeFields = type.getFields();
          const extensionFields: Record<string, boolean> = Object.create(null);
          let isExtensionFieldsEmpty = true;

          for (const fieldName in sourceTypeFields) {
            if (!targetTypeFields[fieldName]) {
              extensionFields[fieldName] = true;
              isExtensionFieldsEmpty = false;
            }
          }

          if (!isExtensionFieldsEmpty) {
            interfaceExtensionsMap[typeName] = extensionFields;
          }
        }

        if (!isAbstractType(targetType) || typeName in interfaceExtensionsMap) {
          const implementations = sourceSchema.getPossibleTypes(type);
          possibleTypesMap[typeName] = [];

          for (const impl of implementations) {
            if (targetTypeMap[impl.name]) {
              possibleTypesMap[typeName].push(impl.name);
            }
          }
        }
      }
    }

    return {
      possibleTypesMap,
      reversePossibleTypesMap: reversePossibleTypesMap(possibleTypesMap),
      interfaceExtensionsMap,
      fieldNodesByType: sourceSchema.extensions?.['stitchingInfo'].fieldNodesByType ?? {},
      fieldNodesByField: sourceSchema.extensions?.['stitchingInfo'].fieldNodesByField ?? {},
      dynamicSelectionSetsByField: sourceSchema.extensions?.['stitchingInfo'].dynamicSelectionSetsByField ?? {},
    };
  }
);

function reversePossibleTypesMap(possibleTypesMap: Record<string, Array<string>>): Record<string, Array<string>> {
  const result: Record<string, Array<string>> = Object.create(null);
  for (const typeName in possibleTypesMap) {
    const toTypeNames = possibleTypesMap[typeName];
    for (const toTypeName of toTypeNames) {
      if (!(toTypeName in result)) {
        result[toTypeName] = [];
      }
      result[toTypeName].push(typeName);
    }
  }
  return result;
}

function getExpandedFragments(
  fragments: Array<FragmentDefinitionNode>,
  fragmentNames: Set<string>,
  possibleTypesMap: Record<string, Array<string>>
): {
  expandedFragments: Array<FragmentDefinitionNode>;
  fragmentReplacements: Record<string, Array<{ fragmentName: string; typeName: string }>>;
} {
  let fragmentCounter = 0;
  function generateFragmentName(typeName: string): string {
    let fragmentName: string;

    do {
      fragmentName = `_${typeName}_Fragment${fragmentCounter.toString()}`;
      fragmentCounter++;
    } while (fragmentNames.has(fragmentName));

    return fragmentName;
  }

  const expandedFragments: Array<FragmentDefinitionNode> = [];
  const fragmentReplacements: Record<string, Array<{ fragmentName: string; typeName: string }>> = Object.create(null);
  for (const fragment of fragments) {
    const possibleTypes = possibleTypesMap[fragment.typeCondition.name.value];

    if (possibleTypes != null) {
      const fragmentName = fragment.name.value;
      fragmentReplacements[fragmentName] = [];
      for (const possibleTypeName of possibleTypes) {
        const name = generateFragmentName(possibleTypeName);
        fragmentNames.add(name);

        expandedFragments.push({
          kind: Kind.FRAGMENT_DEFINITION,
          name: {
            kind: Kind.NAME,
            value: name,
          },
          typeCondition: {
            kind: Kind.NAMED_TYPE,
            name: {
              kind: Kind.NAME,
              value: possibleTypeName,
            },
          },
          selectionSet: fragment.selectionSet,
        });

        fragmentReplacements[fragmentName].push({
          fragmentName: name,
          typeName: possibleTypeName,
        });
      }
    }
  }

  return {
    expandedFragments,
    fragmentReplacements,
  };
}

function wrapConcreteTypes(
  returnType: GraphQLOutputType,
  targetSchema: GraphQLSchema,
  document: DocumentNode
): DocumentNode {
  const namedType = getNamedType(returnType);

  if (!isObjectType(namedType)) {
    return document;
  }

  const rootTypeNames = getRootTypeNames(targetSchema);

  const typeInfo = new TypeInfo(targetSchema);
  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      [Kind.FRAGMENT_DEFINITION]: (node: FragmentDefinitionNode) => {
        const typeName = node.typeCondition.name.value;
        if (!rootTypeNames.has(typeName)) {
          return false;
        }
      },
      [Kind.FIELD]: (node: FieldNode) => {
        const type = typeInfo.getType();
        if (type != null && isAbstractType(getNamedType(type))) {
          return {
            ...node,
            selectionSet: {
              kind: Kind.SELECTION_SET,
              selections: [
                {
                  kind: Kind.INLINE_FRAGMENT,
                  typeCondition: {
                    kind: Kind.NAMED_TYPE,
                    name: {
                      kind: Kind.NAME,
                      value: namedType.name,
                    },
                  },
                  selectionSet: node.selectionSet,
                },
              ],
            },
          };
        }
      },
    }),
    // visitorKeys argument usage a la https://github.com/gatsbyjs/gatsby/blob/master/packages/gatsby-source-graphql/src/batching/merge-queries.js
    // empty keys cannot be removed only because of typescript errors
    // will hopefully be fixed in future version of graphql-js to be optional
    {
      Name: [],

      Document: ['definitions'],
      OperationDefinition: ['selectionSet'],
      VariableDefinition: [],
      Variable: [],
      SelectionSet: ['selections'],
      Field: [],
      Argument: [],

      FragmentSpread: [],
      InlineFragment: ['selectionSet'],
      FragmentDefinition: ['selectionSet'],

      IntValue: [],
      FloatValue: [],
      StringValue: [],
      BooleanValue: [],
      NullValue: [],
      EnumValue: [],
      ListValue: [],
      ObjectValue: [],
      ObjectField: [],

      Directive: [],

      NamedType: [],
      ListType: [],
      NonNullType: [],

      SchemaDefinition: [],
      OperationTypeDefinition: [],

      ScalarTypeDefinition: [],
      ObjectTypeDefinition: [],
      FieldDefinition: [],
      InputValueDefinition: [],
      InterfaceTypeDefinition: [],
      UnionTypeDefinition: [],
      EnumTypeDefinition: [],
      EnumValueDefinition: [],
      InputObjectTypeDefinition: [],

      DirectiveDefinition: [],

      SchemaExtension: [],

      ScalarTypeExtension: [],
      ObjectTypeExtension: [],
      InterfaceTypeExtension: [],
      UnionTypeExtension: [],
      EnumTypeExtension: [],
      InputObjectTypeExtension: [],
    }
  );
}

function addSelectionsToSet(set: Set<SelectionNode>, selections: ReadonlyArray<SelectionNode>): void {
  for (const selection of selections) {
    set.add(selection);
  }
}
