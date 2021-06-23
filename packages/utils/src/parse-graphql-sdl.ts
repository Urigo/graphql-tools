import {
  DocumentNode,
  Kind,
  TokenKind,
  ASTNode,
  parse,
  Source as GraphQLSource,
  visit,
  isTypeSystemDefinitionNode,
  StringValueNode,
  print,
} from 'graphql';
import { dedentBlockStringValue } from 'graphql/language/blockString.js';
import { GraphQLParseOptions } from './Interfaces';

export function parseGraphQLSDL(location: string | undefined, rawSDL: string, options: GraphQLParseOptions = {}) {
  let document: DocumentNode;
  const sdl: string = rawSDL;

  try {
    if (options.commentDescriptions && sdl.includes('#')) {
      document = transformCommentsToDescriptions(rawSDL, options);

      // If noLocation=true, we need to make sure to print and parse it again, to remove locations,
      // since `transformCommentsToDescriptions` must have locations set in order to transform the comments
      // into descriptions.
      if (options.noLocation) {
        document = parse(print(document), options);
      }
    } else {
      document = parse(new GraphQLSource(sdl, location), options);
    }
  } catch (e) {
    if (e.message.includes('EOF') && sdl.replace(/(\#[^*]*)/g, '').trim() === '') {
      document = {
        kind: Kind.DOCUMENT,
        definitions: [],
      };
    } else {
      throw e;
    }
  }

  return {
    location,
    document,
  };
}

export function getLeadingCommentBlock(node: ASTNode): void | string {
  const loc = node.loc;

  if (!loc) {
    return;
  }

  const comments = [];
  let token = loc.startToken.prev;

  while (
    token != null &&
    token.kind === TokenKind.COMMENT &&
    token.next &&
    token.prev &&
    token.line + 1 === token.next.line &&
    token.line !== token.prev.line
  ) {
    const value = String(token.value);
    comments.push(value);
    token = token.prev;
  }

  return comments.length > 0 ? comments.reverse().join('\n') : undefined;
}

export function transformCommentsToDescriptions(sourceSdl: string, options: GraphQLParseOptions = {}): DocumentNode {
  const parsedDoc = parse(sourceSdl, {
    ...options,
    noLocation: false,
  });
  const modifiedDoc = visit(parsedDoc, {
    leave: (node: ASTNode) => {
      if (isDescribable(node)) {
        const rawValue = getLeadingCommentBlock(node);

        if (rawValue !== undefined) {
          const commentsBlock = dedentBlockStringValue('\n' + rawValue);
          const isBlock = commentsBlock.includes('\n');

          if (!node.description) {
            return {
              ...node,
              description: {
                kind: Kind.STRING,
                value: commentsBlock,
                block: isBlock,
              },
            };
          } else {
            return {
              ...node,
              description: {
                ...node.description,
                value: node.description.value + '\n' + commentsBlock,
                block: true,
              },
            };
          }
        }
      }
    },
  });

  return modifiedDoc;
}

type DiscriminateUnion<T, U> = T extends U ? T : never;
type DescribableASTNodes = DiscriminateUnion<
  ASTNode,
  {
    description?: StringValueNode;
  }
>;

export function isDescribable(node: ASTNode): node is DescribableASTNodes {
  return (
    isTypeSystemDefinitionNode(node) ||
    node.kind === Kind.FIELD_DEFINITION ||
    node.kind === Kind.INPUT_VALUE_DEFINITION ||
    node.kind === Kind.ENUM_VALUE_DEFINITION
  );
}
