import { Config } from './merge-typedefs';
import { DefinitionNode, Kind, NameNode, SchemaDefinitionNode, SchemaExtensionNode } from 'graphql';
import { mergeType } from './type';
import { mergeEnum } from './enum';
import { mergeScalar } from './scalar';
import { mergeUnion } from './union';
import { mergeInputType } from './input-type';
import { mergeInterface } from './interface';
import { mergeDirective } from './directives';
import { collectComment } from './comments';
import { mergeSchemaDefs } from './schema-def';

export const schemaDefSymbol = 'SCHEMA_DEF_SYMBOL';

export type MergedResultMap = Record<string, NamedDefinitionNode> & {
  [schemaDefSymbol]: SchemaDefinitionNode | SchemaExtensionNode;
};
export type NamedDefinitionNode = DefinitionNode & { name?: NameNode };

export function isNamedDefinitionNode(definitionNode: DefinitionNode): definitionNode is NamedDefinitionNode {
  return 'name' in definitionNode;
}

export function mergeGraphQLNodes(nodes: ReadonlyArray<DefinitionNode>, config?: Config): MergedResultMap {
  const mergedResultMap = {} as MergedResultMap;
  for (const nodeDefinition of nodes) {
    if (isNamedDefinitionNode(nodeDefinition)) {
      const name = nodeDefinition.name?.value;
      if (config?.commentDescriptions) {
        collectComment(nodeDefinition);
      }

      if (name == null) {
        continue;
      }

      if (config?.exclusions?.includes(name + '.*') || config?.exclusions?.includes(name)) {
        delete mergedResultMap[name];
      } else {
        switch (nodeDefinition.kind) {
          case Kind.OBJECT_TYPE_DEFINITION:
          case Kind.OBJECT_TYPE_EXTENSION:
            mergedResultMap[name] = mergeType(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.ENUM_TYPE_DEFINITION:
          case Kind.ENUM_TYPE_EXTENSION:
            mergedResultMap[name] = mergeEnum(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.UNION_TYPE_DEFINITION:
          case Kind.UNION_TYPE_EXTENSION:
            mergedResultMap[name] = mergeUnion(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.SCALAR_TYPE_DEFINITION:
          case Kind.SCALAR_TYPE_EXTENSION:
            mergedResultMap[name] = mergeScalar(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.INPUT_OBJECT_TYPE_DEFINITION:
          case Kind.INPUT_OBJECT_TYPE_EXTENSION:
            mergedResultMap[name] = mergeInputType(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.INTERFACE_TYPE_DEFINITION:
          case Kind.INTERFACE_TYPE_EXTENSION:
            mergedResultMap[name] = mergeInterface(nodeDefinition, mergedResultMap[name] as any, config);
            break;
          case Kind.DIRECTIVE_DEFINITION:
            mergedResultMap[name] = mergeDirective(nodeDefinition, mergedResultMap[name] as any);
            break;
        }
      }
    } else if (nodeDefinition.kind === Kind.SCHEMA_DEFINITION || nodeDefinition.kind === Kind.SCHEMA_EXTENSION) {
      mergedResultMap[schemaDefSymbol] = mergeSchemaDefs(nodeDefinition, mergedResultMap[schemaDefSymbol], config);
    }
  }
  return mergedResultMap;
}
