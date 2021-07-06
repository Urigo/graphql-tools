import '../../testing/to-be-similar-gql-doc';
import { mergeDirectives, mergeTypeDefs, mergeGraphQLTypes } from '../src';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch'
import { buildSchema, buildClientSchema, print, parse, Kind } from 'graphql';
import { stripWhitespaces } from './utils';
import gql from 'graphql-tag';
import { readFileSync } from 'fs';
import { join } from 'path';
import { assertSome } from '@graphql-tools/utils';

const introspectionSchema = JSON.parse(readFileSync(join(__dirname, './schema.json'), 'utf8'));

const clientType = /* GraphQL */`
  type Client {
    id: ID!
    name: String
    age: Int
    dob: Date
    settings: JSON
    products: [Product]
  }

  # Comments on top of type definition
  # Second comment line
  # Third comment line
  # Fourth comment line
  type ClientWithCommentOnTop {
    # ClientID
    id: ID!
    # Name
    name: String
  }

  type ClientWithComment {
    # ClientID
    # Second comment line
    # Third comment line
    # Fourth comment line
    id: ID!
    # Name
    name: String
  }

  type Query {
    clients: [Client]
    client(id: ID!): Client
  }

  type Mutation {
    # Creates a new client with their name & age
    create_client(name: String!, age: Int!): Client
    update_client(id: ID!, name: String!, age: Int!): Client
  }

  type Subscription {
    activeClients: [Client]
    inactiveClients: [Client]
  }

  input ClientForm {
    name: String!
    age: Int!
  }

  input ClientAgeForm {
    age: Int!
  }

  input ClientFormInputWithComment {
    # Name
    name: String!
    # Age
    age: Int!
  }

  enum ClientStatus {
    NEW
    ACTIVE
    INACTIVE
  }

  scalar Date

  scalar JSON
`;

const productType = /* GraphQL */ `
  type Product {
    id: ID!
    description: String
    price: Int
    tag: TAG
    clients: [Client]
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }

  type Mutation {
    # Creates a new product with it's description & price
    create_product(description: String!, price: Int!): Product
    update_product(
      # product id
      id: ID!
      # product description
      description: String!
      # product price
      price: Int!
    ): Product
  }

  type Subscription {
    activeProducts: [Product]
  }

  enum ProductTypes {
    # New
    NEW
    # Used
    USED
    # Refurbished
    REFURBISHED
  }

  scalar TAG

  enum ProductPriceType {
    REGULAR
    PROMOTION
    SALE
  }
`;

describe('Merge TypeDefs', () => {
  describe('AST Schema Fixing', () => {
    it('Should handle correctly schema without valid root AST node', () => {
      const schema = buildSchema(`
        type A {
          a: String
        }

        type Query {
          a: A
        }
      `);

      expect(schema.astNode).toBeUndefined();

      expect(() => {
        mergeGraphQLTypes([schema], {
          useSchemaDefinition: true,
        });
      }).not.toThrow();
    });

    it('Should handle correctly schema without valid types AST nodes', () => {
      const schema = buildClientSchema(introspectionSchema as any);

      expect(schema.astNode).toBeUndefined();

      expect(() => {
        mergeGraphQLTypes([schema], {
          useSchemaDefinition: true,
        });
      }).not.toThrow();
    });
  });

  describe('mergeGraphQLTypes', () => {
    it('should return the correct definition of Schema', () => {
      const mergedArray = mergeGraphQLTypes(['type Query { f1: String }', 'type Query { f2: String }', 'type MyType { field: Int } type Query { f3: MyType }'], {
        useSchemaDefinition: true,
      });

      expect(mergedArray.length).toBe(3);
      expect(mergedArray[0].kind).toBe('ObjectTypeDefinition');
      expect(mergedArray[1].kind).toBe('ObjectTypeDefinition');
      expect(mergedArray[2].kind).toBe('SchemaDefinition');

    });

    it('should return the correct definition of Schema', () => {
      const mergedArray = mergeGraphQLTypes(['type Query { f1: String }', 'type Query { f2: String }', 'schema { query: Query }', 'type MyType { field: Int } type Query { f3: MyType }'], {
        useSchemaDefinition: true,
      });

      expect(mergedArray.length).toBe(3);
      expect(mergedArray[0].kind).toBe('ObjectTypeDefinition');
      expect(mergedArray[1].kind).toBe('SchemaDefinition');
      expect(mergedArray[2].kind).toBe('ObjectTypeDefinition');
    });

    it('should accept root schema object', () => {
      const mergedSchema = mergeTypeDefs(['type RootQuery { f1: String }', 'type RootQuery { f2: String }', 'schema { query: RootQuery }', 'type MyType { field: Int } type RootQuery { f3: MyType }']);

      const schema = makeExecutableSchema({
        typeDefs: mergedSchema,
      });
      const queryType = schema.getQueryType();

      expect(queryType).toBeDefined();
      assertSome(queryType)
      expect(queryType.name).toEqual('RootQuery');
    });

    it('should return the correct definition of Schema when it defined multiple times', () => {
      const mergedArray = mergeGraphQLTypes(['type Query { f1: String }', 'type Query { f2: String }', 'schema { query: Query }', 'schema { query: Query }', 'schema { query: Query }', 'type MyType { field: Int } type Query { f3: MyType }'], {
        useSchemaDefinition: true,
      });

      expect(mergedArray.length).toBe(3);
      expect(mergedArray[0].kind).toBe('ObjectTypeDefinition');
      expect(mergedArray[1].kind).toBe('SchemaDefinition');
      expect(mergedArray[2].kind).toBe('ObjectTypeDefinition');
    });
  });

  describe('mergeTypeDefs', () => {
    it('should return a Document with the correct values', () => {
      const merged = mergeTypeDefs(['type Query { f1: String }', 'type Query { f2: String }', 'type MyType { field: Int } type Query { f3: MyType }']);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
          f2: String
          f3: MyType
        }

        type MyType {
          field: Int
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should skip printing schema definition object on session', () => {
      const merged = mergeTypeDefs(['type Query { f1: String }', 'type Query { f2: String }', 'type MyType { field: Int } type Query { f3: MyType }'], {
        useSchemaDefinition: false,
      });

      const output = stripWhitespaces(print(merged));

      expect(output).not.toContain('schema {');

      expect(output).toBe(
        stripWhitespaces(`
        type Query {
          f1: String
          f2: String
          f3: MyType
        }

        type MyType {
          field: Int
        }`)
      );
    });

    it('should keep scalars', () => {
      const mergedSchema = mergeTypeDefs([buildSchema('scalar UniqueId')]);

      expect(print(mergedSchema).indexOf('scalar')).not.toEqual(-1);

      const schema = makeExecutableSchema({
        typeDefs: mergedSchema,
      });

      expect(schema.getType('UniqueId')).toBeDefined();
    });

    it('should merge scalar directives', () => {
      const merged = mergeTypeDefs([
        `
        scalar JSON
        directive @sqlType(type: String!) on SCALAR
        extend scalar JSON @sqlType(type: "json")
        `
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
          scalar JSON @sqlType(type: "json")

          directive @sqlType(type: String!) on SCALAR
          `
        ));
    });

    it('should merge descriptions', () => {
      const merged = mergeTypeDefs([
        `
          " She's my type "
          type MyType { field1: Int }
        `,
        `
          " or she's not? "
          type MyType { field2: String }
        `,
        `
          " Contains f1 "
          type Query { f1: MyType }
        `,
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        " or she's not? "
        type MyType {
          field1: Int
          field2: String
        }

        " Contains f1 "
        type Query {
          f1: MyType
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should merge everything correctly', () => {
      const merged = mergeTypeDefs([
        'type Query @test { f1: String }',
        'type Query @test2 { f2: String }',
        'type MyType { field: Int } type Query { f3: MyType } union MyUnion = MyType',
        'type MyType2 { field: Int } union MyUnion = MyType2',
        'interface MyInterface { f: Int } type MyType3 implements MyInterface { f: Int }',
        'interface MyInterface2 { f2: Int } type MyType4 implements MyInterface2 { f2: Int }',
        'interface MyInterface3 { f3: Int } type MyType4 implements MyInterface3 { f3: Int }',
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Query @test @test2 {
          f1: String
          f2: String
          f3: MyType
        }
        type MyType {
          field: Int
        }
        union MyUnion = MyType | MyType2
        type MyType2 {
          field: Int
        }
        interface MyInterface {
          f: Int
        }
        type MyType3 implements MyInterface {
          f: Int
        } interface MyInterface2 {
          f2: Int
        }
        type MyType4 implements MyInterface2 & MyInterface3 {
          f2: Int f3: Int
        }
        interface MyInterface3 {
          f3: Int
        }
        schema {
          query: Query
        }
        `)
      );
    });

    it('should include directives', () => {
      const merged = mergeTypeDefs([`directive @id on FIELD_DEFINITION`, `type MyType { id: Int @id }`, `type Query { f1: MyType }`]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
          directive @id on FIELD_DEFINITION

          type MyType {
            id: Int @id
          }

          type Query {
            f1: MyType
          }

          schema {
            query: Query
          }
        `)
      );
    });

    it('should append and extend directives', () => {
      const merged = mergeTypeDefs([
        `directive @id(primitiveArg: String, arrayArg: [String]) on FIELD_DEFINITION`,
        `type MyType { id: Int }`,
        `type MyType { id: Int @id }`,
        `type MyType { id: Int @id(primitiveArg: "1") }`,
        `type MyType { id: Int @id(primitiveArg: "1", arrayArg: ["1"]) }`,
        `type MyType { id: Int @id(arrayArg: ["2"]) }`,
        `type Query { f1: MyType }`,
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
          directive @id(primitiveArg: String, arrayArg: [String]) on FIELD_DEFINITION

          type MyType {
            id: Int @id(primitiveArg: "1", arrayArg: ["1", "2"])
          }

          type Query {
            f1: MyType
          }

          schema {
            query: Query
          }
        `)
      );
    });

    it('should fail if inputs of the same directive are different from each other', (done: jest.DoneCallback) => {
      try {
        mergeTypeDefs([`directive @id on FIELD_DEFINITION`, `directive @id(name: String) on FIELD_DEFINITION`, `type MyType { id: Int @id }`, `type Query { f1: MyType }`]);

        done.fail('It should have failed');
      } catch (e) {
        const msg = stripWhitespaces(e.message);

        expect(msg).toMatch('GraphQL directive "id"');
        expect(msg).toMatch('Existing directive: directive @id on FIELD_DEFINITION');
        expect(msg).toMatch('Received directive: directive @id(name: String) on FIELD_DEFINITION');

        done();
      }
    });

    it('should merge the same directives', () => {
      const merged = mergeTypeDefs([`directive @id on FIELD_DEFINITION`, `directive @id on FIELD_DEFINITION`, `type MyType { id: Int @id }`, `type Query { f1: MyType }`]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
          directive @id on FIELD_DEFINITION

          type MyType {
            id: Int @id
          }

          type Query {
            f1: MyType
          }

          schema {
            query: Query
          }
        `)
      );
    });

    it('stacks all directives on fields', () => {
      const types = [
        /* GraphQL */ `
          type Client {
            id: ID!
            name: String
            age: Int
          }

          type Query {
            client: Client @foo @foo
          }

          type Query {
            client: Client @bar
          }

          type Query {
            client: Client @foo @bar
          }
        `,
      ];
      const merged = print(mergeTypeDefs(types));

      expect(merged.match(/\@foo/g)).toHaveLength(1);
      expect(merged.match(/\@bar/g)).toHaveLength(1);
      expect(merged).toContain('client: Client @foo @bar');
    });

    it('should merge two GraphQLSchema with directives correctly', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: [`type Query { f1: MyType }`, `type MyType { f2: String }`],
        }),
        makeExecutableSchema({
          typeDefs: [`directive @id on FIELD_DEFINITION`, `type MyType2 { f2: String @id }`],
        }),
      ]);

      expect(print(merged)).toContain('f2: String @id');
    });

    it('should merge when directive uses enum', () => {
      const merged = mergeTypeDefs([
        gql`
          directive @date(format: DateFormat) on FIELD_DEFINITION
          enum DateFormat {
            LOCAL
            ISO
          }
        `,
        gql`
          scalar Date

          type Query {
            today: Date @date
          }
        `,
      ]);

      const printed = print(merged);

      expect(printed).toContain('directive @date(format: DateFormat) on FIELD_DEFINITION');
      expect(printed).toContain('today: Date @date');
    });

    it('should merge the same directives and its locations', () => {
      const merged = mergeTypeDefs([`directive @id on FIELD_DEFINITION`, `directive @id on OBJECT`, `type MyType { id: Int @id }`, `type Query { f1: MyType }`]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
          directive @id on FIELD_DEFINITION | OBJECT

          type MyType {
            id: Int @id
          }

          type Query {
            f1: MyType
          }

          schema {
            query: Query
          }
        `)
      );
    });

    it('should merge arguments', () => {
      const merged = mergeTypeDefs([
        /* GraphQL */ `
          type Foo {
            f1(a: String): String
          }

          type Query {
            q1: String
          }
        `,
        /* GraphQL */ `
          type Foo {
            f1(a: String, b: String): String
          }

          type Query {
            q1(success: Boolean): String
          }
        `,
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */ `
          type Foo {
            f1(a: String, b: String): String
          }

          type Query {
            q1(success: Boolean): String
          }

          schema {
            query: Query
          }
        `)
      );
    });
  });

  describe('input arguments', () => {
    it('should handle string correctly', () => {
      const merged = mergeTypeDefs(['type Query { f1: String }']);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should handle compiled gql correctly', () => {
      const merged = mergeTypeDefs([
        gql`
          type Query {
            f1: String
          }
        `,
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should handle compiled gql and strings correctly', () => {
      const merged = mergeTypeDefs([
        gql`
          type Query {
            f1: String
          }
        `,
        'type Query { f2: String }',
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
          f2: String
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should handle GraphQLSchema correctly', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: ['type Query { f1: String }'],
        }),
        'type Query { f2: String }',
      ]);

      expect(stripWhitespaces(print(merged))).toBeSimilarGqlDoc(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
          f2: String
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should merge GraphQL Schemas that have schema definition', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: ['type RootQuery { f1: String }'],
        }),
        makeExecutableSchema({
          typeDefs: ['type RootQuery { f2: String }', 'schema { query: RootQuery }'],
        }),
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type RootQuery {
          f1: String
          f2: String
        }

        schema {
          query: RootQuery
        }`)
      );
    });

    it('should handle all merged correctly', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: ['type Query { f1: String }'],
        }),
        'type Query { f2: String }',
        gql`
          type Query {
            f3: String
          }
        `,
      ]);

      expect(stripWhitespaces(print(merged))).toBeSimilarGqlDoc(
        stripWhitespaces(/* GraphQL */`
        type Query {
          f1: String
          f2: String
          f3: String
        }

        schema {
          query: Query
        }`)
      );
    });

    it('should allow GraphQLSchema with empty Query', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: ['type MyType { f1: String }'],
        }),
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type MyType { f1: String }
        `)
      );
    });

    it('should allow GraphQLSchema with empty Query', () => {
      const merged = mergeTypeDefs([
        makeExecutableSchema({
          typeDefs: ['type MyType { f1: String }'],
        }),
        makeExecutableSchema({
          typeDefs: ['type MyType { f2: String }'],
        }),
      ]);

      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type MyType { f1: String f2: String }
        `)
      );
    });
    it('should handle extend types', () => {
      const merged = mergeTypeDefs([
        `
        type Test {
          foo: String
        }
      `,
        `
        extend type Test {
          bar: String
        }
      `,
      ]);
      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        type Test {
          foo: String
          bar: String
        }
      `)
      );
    });
    it('should handle extend types when GraphQLSchema is the source', () => {
      const schema = stitchSchemas({
        typeDefs: [
          `
          type Query {
            foo: String
          }

          type User {
            name: String
          }
        `,
          `
          extend type Query {
            bar: String
          }

          extend type User {
            id: ID
          }
        `,
        ],
      });
      const merged = mergeTypeDefs([schema]);
      const printed = stripWhitespaces(print(merged));

      expect(printed).toContain(
        stripWhitespaces(/* GraphQL */`
        type Query {
          foo: String
          bar: String
        }
      `)
      );
      expect(printed).toContain(
        stripWhitespaces(/* GraphQL */`
        type User {
          name: String
          id: ID
        }
      `)
      );
    });

    it('should handle extend input types', () => {
      const schema = stitchSchemas({
        typeDefs: [
          `
          type Query {
            foo(i: TestInput): String
          }

          input TestInput {
            t: String!
          }
        `,
          `
          extend input TestInput {
            t2: String!
          }
        `,
        ],
      });
      const merged = mergeTypeDefs([schema]);
      const printed = stripWhitespaces(print(merged));

      expect(printed).toContain(
        stripWhitespaces(/* GraphQL */`
        input TestInput { t: String! t2: String! }
      `)
      );
    });

    it('should fail when a field is already defined and has a different type', () => {
      expect(() => {
        mergeTypeDefs([
          `
          type Query {
            foo: String
          }
        `,
          `
          extend type Query {
            foo: Int
            bar: String
          }
        `,
        ]);
      }).toThrowError('Unable to merge GraphQL type');
    });

    it('should preserve an extend keyword if there is no base', () => {
      const merged = mergeTypeDefs([
        `
        extend type Query {
          foo: String
        }
      `,
        `
        extend type Query {
          bar: String
        }
      `,
      ]);

      const printed = stripWhitespaces(print(merged));

      expect(printed).toContain(
        stripWhitespaces(/* GraphQL */`
        extend type Query {
          foo: String
          bar: String
        }
      `)
      );
    });

    it('should merge unions correctly', () => {
      const merged = mergeTypeDefs([
        `
        type A {
          foo: String
        }

        type B {
          bar: String
        }

        union MyUnion = A | B
      `,
        `
      type C {
        foo: String
      }

        extend union MyUnion = C
      `,
      ]);

      const printed = stripWhitespaces(print(merged));

      expect(printed).toContain(stripWhitespaces(/* GraphQL */`union MyUnion = A | B | C`));
    });

    it('should merge unions correctly without extend', () => {
      const merged = mergeTypeDefs([
        `
        type A {
          foo: String
        }

        type B {
          bar: String
        }

        union MyUnion = A | B
      `,
        `
      type C {
        foo: String
      }

        union MyUnion = C
      `,
      ]);

      const printed = stripWhitespaces(print(merged));

      expect(printed).toContain(stripWhitespaces(/* GraphQL */`union MyUnion = A | B | C`));
    });

    it('should handle extend inputs', () => {
      const merged = mergeTypeDefs([
        `
        input TestInput {
          foo: String
        }
      `,
        `
        extend input TestInput {
          bar: String
        }
      `,
      ]);
      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        input TestInput {
          foo: String
          bar: String
        }
      `)
      );
    });
    it('should extend extension types', () => {
      const merged = mergeTypeDefs([
        `
        extend type Test {
          foo: String
        }
      `,
        `
        extend type Test {
          bar: String
        }
      `,
      ]);
      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        extend type Test {
          foo: String
          bar: String
        }
      `)
      );
    });
    it('should extend extension input types', () => {
      const merged = mergeTypeDefs([
        `
        extend input TestInput {
          foo: String
        }
      `,
        `
        extend input TestInput {
          bar: String
        }
      `,
      ]);
      expect(stripWhitespaces(print(merged))).toBe(
        stripWhitespaces(/* GraphQL */`
        extend input TestInput {
          foo: String
          bar: String
        }
      `)
      );
    });
  });

  describe('comments', () => {
    it('includes mutationType', () => {
      const types = [clientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedMutationType = stripWhitespaces(/* GraphQL */`
        type Mutation {

          # Creates a new client with their name & age
          create_client(name: String!, age: Int!): Client
          update_client(id: ID!, name: String!, age: Int!): Client

          # Creates a new product with it's description & price
          create_product(description: String!, price: Int!): Product
          update_product(
            # product id
            id: ID!,
            # product description
            description: String!,
            # product price
            price: Int!): Product
        }
      `);
      const schema = stripWhitespaces(mergedTypes);

      expect(schema).toContain(expectedMutationType);
    });

    it('includes first product ENUM type', () => {
      const types = [clientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedEnumType = stripWhitespaces(/* GraphQL */`
        enum ProductTypes {
          # New
          NEW
          # Used
          USED
          # Refurbished
          REFURBISHED
        }
      `);
      const separateTypes = stripWhitespaces(mergedTypes);

      expect(separateTypes).toContain(expectedEnumType);
    });

    it('merges enum comments correctly', () => {
      const types = [
        stripWhitespaces(/* GraphQL */ `
          """
            Enum without comments
          """
          enum TestEnum {
            Value1
            Value2
          }
        `),
        stripWhitespaces(/* GraphQL */ `
          """
            Extended Enum with comments and new Value
          """
          enum TestEnum {
            """Value1"""
            Value1

            """Value2"""
            Value2

            """Value3"""
            Value3
          }
        `)
      ];

      const mergedTypes = mergeTypeDefs(types);

      const expectedEnumType = stripWhitespaces(/* GraphQL */`
        """
          Extended Enum with comments and new Value
        """
        enum TestEnum {
          """Value1"""
          Value1

          """Value2"""
          Value2

          """Value3"""
          Value3
        }
      `);
      const separateTypes = stripWhitespaces(print(mergedTypes));

      expect(separateTypes).toContain(expectedEnumType);

    });

    it('preserves the field comments', () => {
      const types = [clientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedClientType = stripWhitespaces(/* GraphQL */`
        type ClientWithComment {
          # ClientID
          # Second comment line
          # Third comment line
          # Fourth comment line
          id: ID!
          # Name
          name: String
        }
      `);
      const separateTypes = stripWhitespaces(mergedTypes);

      expect(separateTypes).toContain(expectedClientType);
    });

    it('preserves the type comments', () => {
      const types = [clientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedClientType = stripWhitespaces(/* GraphQL */`
        # Comments on top of type definition
        # Second comment line
        # Third comment line
        # Fourth comment line
        type ClientWithCommentOnTop {
          # ClientID
          id: ID!
          # Name
          name: String
        }
      `);
      const separateTypes = stripWhitespaces(mergedTypes);

      expect(separateTypes).toContain(expectedClientType);
    });

    it('preserves the input field comments', () => {
      const types = [clientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedClientType = stripWhitespaces(/* GraphQL */`
        input ClientFormInputWithComment {
          # Name
          name: String!
          # Age
          age: Int!
        }
      `);
      const separateTypes = stripWhitespaces(mergedTypes);

      expect(separateTypes).toContain(expectedClientType);
    });

    it('supports already parsed documents', () => {
      const parsedClientType = parse(clientType);
      const types = [parsedClientType, productType];
      const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
      const expectedClientType = stripWhitespaces(/* GraphQL */`
        input ClientFormInputWithComment {
          # Name
          name: String!
          # Age
          age: Int!
        }
      `);
      const separateTypes = stripWhitespaces(mergedTypes);

      expect(separateTypes).toContain(expectedClientType);
    });
  });

  it('supports already parsed documents', () => {
    const parsedClientType = parse(clientType);
    const types = [parsedClientType, productType];
    const mergedTypes = mergeTypeDefs(types, { commentDescriptions: true });
    const expectedClientType = stripWhitespaces(/* GraphQL */`
      input ClientFormInputWithComment {
        # Name
        name: String!
        # Age
        age: Int!
      }
    `);
    const separateTypes = stripWhitespaces(mergedTypes);

    expect(separateTypes).not.toContain('[object Object]');
    expect(separateTypes).toContain(expectedClientType);
  });
  it('excludes fields', () => {
    const userF1Type = stripWhitespaces(/* GraphQL */`
      type User {
        f1: String
      }
    `);
    const userF2Type = stripWhitespaces(/* GraphQL */`
      type User {
        f2: String
      }
    `);
    const mergedTypes = mergeTypeDefs([userF1Type, userF2Type], {
      exclusions: ['User.f1'],
    });
    expect(stripWhitespaces(print(mergedTypes))).toBe(userF2Type);
  });

  it('excludes types', () => {
    const queryType = stripWhitespaces(/* GraphQL */`
      type Query {
        user: User
      }
    `);
    const userType = stripWhitespaces(/* GraphQL */`
      type User {
        name: String
      }
    `);
    const mergedTypes = mergeTypeDefs([queryType, userType], {
      exclusions: ['Query.*'],
    });
    expect(stripWhitespaces(print(mergedTypes))).toBe(userType);
  });

  it('should sort fields', () => {
    const t1 = stripWhitespaces(/* GraphQL */`
      type Query {
        A: String!
        C: String!
      }
    `);
    const t2 = stripWhitespaces(/* GraphQL */`
      extend type Query {
        B: String!
        D: String!
      }
    `);
    const mergedTypes = mergeTypeDefs([t1, t2], { sort: true });
    expect(stripWhitespaces(print(mergedTypes))).toContain(stripWhitespaces(/* GraphQL */`
      type Query {
        A: String!
        B: String!
        C: String!
        D: String!
      }
    `));
  });

  it('should keep indentation in comment descriptions', () => {
    const A = /* GraphQL */`
    type Some {
      # comment1
      #  - first line1
      #  - second line1
      field1: Int
    }
    `;

    const B = /* GraphQL */`
    type Some {
      # comment2
      #  - first line2
      #  - second line2
      field2: Int
    }
    `;

    const result = mergeTypeDefs([A, B], { commentDescriptions: true });
    expect(result).toContain(`# comment1`);
    expect(result).toContain(`#  - first line1`);
    expect(result).toContain(`#  - second line1`);
    expect(result).toContain(`# comment2`);
    expect(result).toContain(`#  - first line2`);
    expect(result).toContain(`#  - second line2`);
  });

  describe.each([['normal', false], ['reverse', true]])('mergeDirectives', (direction, value) => {
    const config = {
      reverseDirectives: value,
    };

    it(`should merge with both schema directives undefined in ${direction} order`, () => {
      expect(mergeDirectives(undefined, undefined, config)).toEqual([]);
    });

    it(`should merge with first schema directives set in ${direction} order`, () => {
      const directives = [{
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: 'firstDirective'
        }
      }];
      expect(mergeDirectives(directives, undefined, config)).toEqual(directives);
    });

    it(`should merge with second schema directives set in ${direction} order`, () => {
      const directives = [{
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: 'firstDirective'
        }
      }];
      expect(mergeDirectives(undefined, directives, config)).toEqual(directives);
    });

    it(`should merge with both schema directives set in ${direction} order`, () => {
      const directives = [{
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: 'firstDirective'
        }
      }];
      expect(mergeDirectives(directives, directives, config)).toEqual(directives);
    });

    it(`should merge with both schema directives set, one of which has arguments in ${direction} order`, () => {
      const directivesOne = [{
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: 'firstDirective'
        }
      }];
      const directivesTwo = [{
        kind: Kind.DIRECTIVE,
        name: {
          kind: Kind.NAME,
          value: 'firstDirective'
        },
        arguments: [{
          kind: Kind.ARGUMENT,
          name: {
            kind: Kind.NAME,
            value: 'firstArg'
          },
          value: {
            kind: Kind.STRING,
            value: 'arg'
          }
        }]
      }];

      expect(mergeDirectives(directivesOne, directivesTwo, config)).toEqual(directivesTwo);
    });
  })
});
