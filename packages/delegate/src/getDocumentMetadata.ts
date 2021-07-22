import { DocumentNode, FragmentDefinitionNode, Kind, OperationDefinitionNode } from 'graphql';

export function getDocumentMetadata(document: DocumentNode): {
  operations: Array<OperationDefinitionNode>;
  fragments: Array<FragmentDefinitionNode>;
  fragmentNames: Set<string>;
} {
  const operations: OperationDefinitionNode[] = [];
  const fragments: FragmentDefinitionNode[] = [];
  const fragmentNames = new Set<string>();
  for (let i = 0; i < document.definitions.length; i++) {
    const def = document.definitions[i];

    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.push(def);
      fragmentNames.add(def.name.value);
    } else if (def.kind === Kind.OPERATION_DEFINITION) {
      operations.push(def);
    }
  }

  return {
    operations,
    fragments,
    fragmentNames,
  };
}
