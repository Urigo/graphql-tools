import { transformCommentsToDescriptions, parseGraphQLSDL } from "../src/parse-graphql-sdl";
import { Kind, print, ObjectTypeDefinitionNode } from 'graphql';

describe('parse sdl', () => {
  describe('parseGraphQLSDL', () => {
    it('Should work correctly with empty document (everything is commented out)', () => {
      const doc = /* GraphQL */`
        #query test {
        #  id
        #}
      `;

      expect(parseGraphQLSDL('a.graphql', doc).document).toEqual({
        kind: Kind.DOCUMENT,
        definitions: [],
      });
    });
  });

  describe('comment parsing', () => {
    const ast = /* GraphQL */`
      # test type comment
      type Type {
        # test field comment
        f1: String!
        # Line 1
        #Line 2
        f2: String!
        # Line 1
        "line 2"
        f3: String!
      }

      # test extension
      extend type Type {
        # test extension field comment
        f4: String!
      }

      type OtherType implements Node {
        id: ID!
        f: String!
      }

      # input test
      input Input {
        # Input field test
        f: String
      }

      # Enum test
      enum Enum {
        # Enum value test
        V1
        V2
      }

      # Union test
      union Union = Type | OtherType

      # Interface test
      interface Node {
        id: ID!
      }

      # Custom scalar test
      scalar Date
    `;

    it('should transform comments to descriptions correctly on all available nodes', () => {
      const transformed = transformCommentsToDescriptions(ast);
      const printed = print(transformed);

      expect(printed).toMatchSnapshot();
    });

    it('should transform comments to descriptions correctly on all available nodes with noLocation=true', () => {
      const transformed = parseGraphQLSDL('test.graphql', ast, { noLocation: true, commentDescriptions: true });
      const type = transformed.document.definitions.find((d): d is ObjectTypeDefinitionNode => "name" in d && d.name?.value === 'Type');
      expect(type?.description?.value).toBe('test type comment');
      expect(type?.loc).not.toBeDefined();
      const printed = print(transformed.document);
      expect(printed).toMatchSnapshot();
    });
  });
});
