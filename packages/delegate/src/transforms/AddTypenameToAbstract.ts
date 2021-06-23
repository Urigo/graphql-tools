import {
  GraphQLType,
  DocumentNode,
  TypeInfo,
  visit,
  visitWithTypeInfo,
  SelectionSetNode,
  Kind,
  GraphQLSchema,
  isAbstractType,
} from 'graphql';

import { Maybe, Request } from '@graphql-tools/utils';

import { Transform, DelegationContext } from '../types';

export default class AddTypenameToAbstract implements Transform {
  public transformRequest(
    originalRequest: Request,
    delegationContext: DelegationContext,
    _transformationContext: Record<string, any>
  ): Request {
    const document = addTypenameToAbstract(delegationContext.targetSchema, originalRequest.document);
    return {
      ...originalRequest,
      document,
    };
  }
}

function addTypenameToAbstract(targetSchema: GraphQLSchema, document: DocumentNode): DocumentNode {
  const typeInfo = new TypeInfo(targetSchema);
  return visit(
    document,
    visitWithTypeInfo(typeInfo, {
      [Kind.SELECTION_SET](node: SelectionSetNode): SelectionSetNode | null | undefined {
        const parentType: Maybe<GraphQLType> = typeInfo.getParentType();
        let selections = node.selections;
        if (parentType != null && isAbstractType(parentType)) {
          selections = selections.concat({
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: '__typename',
            },
          });
        }

        if (selections !== node.selections) {
          return {
            ...node,
            selections,
          };
        }
      },
    })
  );
}
