import {
  DocumentNode,
  FragmentDefinitionNode,
  GraphQLNamedType,
  GraphQLSchema,
  Kind,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
  TypeInfo,
  getNamedType,
  isAbstractType,
  isInterfaceType,
  visit,
  visitWithTypeInfo,
} from 'graphql';

import { implementsAbstractType, Request } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '../types';

export default class ExpandAbstractTypes implements Transform {
  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): Request {
    const targetSchema = delegationContext.targetSchema;
    const { possibleTypesMap, interfaceExtensionsMap } = extractPossibleTypes(
      delegationContext.info.schema,
      targetSchema
    );
    const reversePossibleTypesMap = flipMapping(possibleTypesMap);
    const document = expandAbstractTypes(
      targetSchema,
      possibleTypesMap,
      reversePossibleTypesMap,
      interfaceExtensionsMap,
      originalRequest.document
    );

    return {
      ...originalRequest,
      document,
    };
  }
}

function extractPossibleTypes(sourceSchema: GraphQLSchema, targetSchema: GraphQLSchema) {
  const typeMap = sourceSchema.getTypeMap();
  const possibleTypesMap: Record<string, Array<string>> = Object.create(null);
  const interfaceExtensionsMap: Record<string, Record<string, boolean>> = Object.create(null);
  for (const typeName in typeMap) {
    const type = typeMap[typeName];
    if (isAbstractType(type)) {
      const targetType = targetSchema.getType(typeName);

      if (isInterfaceType(type) && isInterfaceType(targetType)) {
        const targetTypeFields = targetType.getFields();
        const extensionFields: Record<string, boolean> = Object.create(null);
        let isExtensionFieldsEmpty = true;
        for (const fieldName in type.getFields()) {
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
        possibleTypesMap[typeName] = implementations
          .filter(impl => targetSchema.getType(impl.name))
          .map(impl => impl.name);
      }
    }
  }
  return { possibleTypesMap, interfaceExtensionsMap };
}

function flipMapping(mapping: Record<string, Array<string>>): Record<string, Array<string>> {
  const result: Record<string, Array<string>> = Object.create(null);
  for (const typeName in mapping) {
    const toTypeNames = mapping[typeName];
    for (const toTypeName of toTypeNames) {
      if (!(toTypeName in result)) {
        result[toTypeName] = [];
      }
      result[toTypeName].push(typeName);
    }
  }
  return result;
}

function expandAbstractTypes(
  targetSchema: GraphQLSchema,
  possibleTypesMap: Record<string, Array<string>>,
  reversePossibleTypesMap: Record<string, Array<string>>,
  interfaceExtensionsMap: Record<string, Record<string, boolean>>,
  document: DocumentNode
): DocumentNode {
  const operations: Array<OperationDefinitionNode> = document.definitions.filter(
    def => def.kind === Kind.OPERATION_DEFINITION
  ) as Array<OperationDefinitionNode>;

  const fragments: Array<FragmentDefinitionNode> = document.definitions.filter(
    def => def.kind === Kind.FRAGMENT_DEFINITION
  ) as Array<FragmentDefinitionNode>;

  const existingFragmentNames = fragments.map(fragment => fragment.name.value);
  let fragmentCounter = 0;
  const generateFragmentName = (typeName: string) => {
    let fragmentName;
    do {
      fragmentName = `_${typeName}_Fragment${fragmentCounter.toString()}`;
      fragmentCounter++;
    } while (existingFragmentNames.indexOf(fragmentName) !== -1);
    return fragmentName;
  };
  const generateInlineFragment = (typeName: string, selectionSet: SelectionSetNode) => {
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
  };

  const newFragments: Array<FragmentDefinitionNode> = [];
  const fragmentReplacements: Record<string, Array<{ fragmentName: string; typeName: string }>> = Object.create(null);

  for (const fragment of fragments) {
    newFragments.push(fragment);
    const possibleTypes = possibleTypesMap[fragment.typeCondition.name.value];
    if (possibleTypes != null) {
      fragmentReplacements[fragment.name.value] = [];
      for (const possibleTypeName of possibleTypes) {
        const name = generateFragmentName(possibleTypeName);
        existingFragmentNames.push(name);
        const newFragment: FragmentDefinitionNode = {
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
        };
        newFragments.push(newFragment);

        fragmentReplacements[fragment.name.value].push({
          fragmentName: name,
          typeName: possibleTypeName,
        });
      }
    }
  }

  const newDocument = {
    ...document,
    definitions: [...operations, ...newFragments],
  };
  const typeInfo = new TypeInfo(targetSchema);
  return visit(
    newDocument,
    visitWithTypeInfo(typeInfo, {
      [Kind.SELECTION_SET](node: SelectionSetNode) {
        let newSelections = node.selections;
        const addedSelections = [];
        const maybeType = typeInfo.getParentType();
        if (maybeType != null) {
          const parentType: GraphQLNamedType = getNamedType(maybeType);
          const interfaceExtension = interfaceExtensionsMap[parentType.name];
          const interfaceExtensionFields = [] as Array<SelectionNode>;
          for (const selection of node.selections) {
            if (selection.kind === Kind.INLINE_FRAGMENT) {
              if (selection.typeCondition != null) {
                const possibleTypes = possibleTypesMap[selection.typeCondition.name.value];
                if (possibleTypes != null) {
                  for (const possibleType of possibleTypes) {
                    const maybePossibleType = targetSchema.getType(possibleType);
                    if (
                      maybePossibleType != null &&
                      implementsAbstractType(targetSchema, parentType, maybePossibleType)
                    ) {
                      addedSelections.push(generateInlineFragment(possibleType, selection.selectionSet));
                    }
                  }
                }
              }
            } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
              const fragmentName = selection.name.value;
              if (fragmentName in fragmentReplacements) {
                for (const replacement of fragmentReplacements[fragmentName]) {
                  const typeName = replacement.typeName;
                  const maybeReplacementType = targetSchema.getType(typeName);
                  if (maybeReplacementType != null && implementsAbstractType(targetSchema, parentType, maybeType)) {
                    addedSelections.push({
                      kind: Kind.FRAGMENT_SPREAD,
                      name: {
                        kind: Kind.NAME,
                        value: replacement.fragmentName,
                      },
                    });
                  }
                }
              }
            } else if (
              interfaceExtension != null &&
              interfaceExtension[selection.name.value] &&
              selection.kind === Kind.FIELD
            ) {
              interfaceExtensionFields.push(selection);
            }
          }

          if (parentType.name in reversePossibleTypesMap) {
            addedSelections.push({
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
                addedSelections.push(
                  generateInlineFragment(possibleType, {
                    kind: Kind.SELECTION_SET,
                    selections: interfaceExtensionFields,
                  })
                );
              }

              newSelections = newSelections.filter(
                (selection: SelectionNode) =>
                  !(selection.kind === Kind.FIELD && interfaceExtension[selection.name.value])
              );
            }
          }
        }

        if (addedSelections.length) {
          return {
            ...node,
            selections: newSelections.concat(addedSelections),
          };
        }
      },
    })
  );
}
