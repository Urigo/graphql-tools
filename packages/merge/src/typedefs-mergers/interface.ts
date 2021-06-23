import { Config } from './merge-typedefs';
import { InterfaceTypeDefinitionNode, InterfaceTypeExtensionNode } from 'graphql';
import { mergeFields } from './fields';
import { mergeDirectives } from './directives';

export function mergeInterface(
  node: InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode,
  existingNode: InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode,
  config?: Config
): InterfaceTypeDefinitionNode | InterfaceTypeExtensionNode {
  if (existingNode) {
    try {
      return {
        name: node.name,
        description: node['description'] || existingNode['description'],
        kind:
          (config && config.convertExtensions) ||
          node.kind === 'InterfaceTypeDefinition' ||
          existingNode.kind === 'InterfaceTypeDefinition'
            ? 'InterfaceTypeDefinition'
            : 'InterfaceTypeExtension',
        loc: node.loc,
        fields: mergeFields(node, node.fields, existingNode.fields, config),
        directives: mergeDirectives(node.directives, existingNode.directives, config),
      } as any;
    } catch (e) {
      throw new Error(`Unable to merge GraphQL interface "${node.name.value}": ${e.message}`);
    }
  }

  return config && config.convertExtensions
    ? {
        ...node,
        kind: 'InterfaceTypeDefinition',
      }
    : node;
}
