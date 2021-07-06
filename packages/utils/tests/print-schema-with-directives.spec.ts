import { RenameTypes, wrapSchema } from '@graphql-tools/wrap';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { buildSchema, GraphQLDirective, printSchema, GraphQLSchema, specifiedDirectives, GraphQLObjectType, GraphQLNonNull, GraphQLID, GraphQLList } from 'graphql';
import { printSchemaWithDirectives } from '../src';
import { GraphQLJSON } from 'graphql-scalars';

describe('printSchemaWithDirectives', () => {
  it(`Should print with directives, while printSchema doesn't`, () => {
    const schemaWithDirectives = buildSchema(/* GraphQL */ `
      directive @entity on OBJECT
      directive @id on FIELD_DEFINITION
      directive @link on FIELD_DEFINITION

      type Query {
        me: User
      }

      type User @entity {
        id: ID! @id
        friends: [User!]! @link
      }
    `);

    const printedSchemaByGraphQL = printSchema(schemaWithDirectives);
    expect(printedSchemaByGraphQL).toContain('directive @entity on OBJECT');
    expect(printedSchemaByGraphQL).not.toContain(`id: ID! @id`);
    expect(printedSchemaByGraphQL).not.toContain(`friends: [User!]! @link`);
    expect(printedSchemaByGraphQL).not.toContain(`type User @entity`);
    const printedSchemaAlternative = printSchemaWithDirectives(schemaWithDirectives);
    expect(printedSchemaAlternative).toContain('directive @entity on OBJECT');
    expect(printedSchemaAlternative).toContain(`id: ID! @id`);
    expect(printedSchemaAlternative).toContain(`friends: [User!]! @link`);
    expect(printedSchemaAlternative).toContain(`type User @entity`);
  });

  it('Should print with directives, even without definitions', () => {
    const schemaWithDirectives = stitchSchemas({
      typeDefs: /* GraphQL */ `
        type Query {
          me: User
        }

        type User @entity {
          id: ID! @id
          friends: [User!]! @link
        }
      `
    });

    const printedSchema = printSchemaWithDirectives(schemaWithDirectives);
    expect(printedSchema).toContain(`id: ID! @id`);
    expect(printedSchema).toContain(`friends: [User!]! @link`);
    expect(printedSchema).toContain(`type User @entity`);
  });

  it('Should print with directives, even when using extend', () => {
    // note that in graphql v14, similar test will fail when using buildSchema from graphql-js
    // instead of makeExecutableSchema, because in v14, buildSchema ignores the extend keywords
    const schemaWithDirectives = makeExecutableSchema({
      typeDefs: `
        directive @entity on OBJECT

        type Query {
          me: User
        }

        type User {
          id: ID!
          friends: [User!]!
        }

        extend type User @entity
      `
    });

    const printedSchemaAlternative = printSchemaWithDirectives(schemaWithDirectives);
    expect(printedSchemaAlternative).toContain('directive @entity on OBJECT');
    expect(printedSchemaAlternative).toContain(`type User @entity`);
  });

  it('Should print with directives even with code-first approach', () => {
    const schemaTypes = Object.create(null);
    schemaTypes.Query = new GraphQLObjectType({
      name: 'Query',
      fields: () => ({
        me: { type: schemaTypes.User}
      }),
    });
    schemaTypes.User = new GraphQLObjectType({
      name: 'User',
      fields: () => ({
        id: {
          type: new GraphQLNonNull(GraphQLID),
          extensions: {
            directives: {
              id: {},
            },
          },
        },
        friends: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(schemaTypes.User))),
          extensions: {
            directives: {
              link: {},
            },
          },
        },
      }),
      extensions: {
        directives: {
          entity: {},
        },
      },
    });

    const schemaWithDirectives = new GraphQLSchema({
      query: schemaTypes.Query,
      directives: specifiedDirectives.concat([
        new GraphQLDirective({
          name: 'entity',
          locations: ['OBJECT'],
        }),
        new GraphQLDirective({
          name: 'id',
          locations: ['FIELD_DEFINITION'],
        }),
        new GraphQLDirective({
          name: 'link',
          locations: ['FIELD_DEFINITION'],
        }),
      ]),
    })

    const printedSchema = printSchemaWithDirectives(schemaWithDirectives);
    expect(printedSchema).toContain('directive @entity on OBJECT');
    expect(printedSchema).toContain(`id: ID! @id`);
    expect(printedSchema).toContain(`friends: [User!]! @link`);
    expect(printedSchema).toContain(`type User @entity`);
  });

  it('Should print with directives with code-first approach, without directive defs', () => {
    const schemaTypes = Object.create(null);
    schemaTypes.Query = new GraphQLObjectType({
      name: 'Query',
      fields: () => ({
        me: { type: schemaTypes.User}
      }),
    });
    schemaTypes.User = new GraphQLObjectType({
      name: 'User',
      fields: () => ({
        id: {
          type: new GraphQLNonNull(GraphQLID),
          extensions: {
            directives: {
              id: {},
            },
          },
        },
        friends: {
          type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(schemaTypes.User))),
          extensions: {
            directives: {
              link: {},
            },
          },
        },
      }),
      extensions: {
        directives: {
          entity: {},
        },
      },
    });

    const schemaWithDirectives = new GraphQLSchema({
      query: schemaTypes.Query,
    })

    const printedSchema = printSchemaWithDirectives(schemaWithDirectives);
    expect(printedSchema).toContain(`id: ID! @id`);
    expect(printedSchema).toContain(`friends: [User!]! @link`);
    expect(printedSchema).toContain(`type User @entity`);
  });

  it(`Should print types correctly if they don't have astNode`, () => {
    const schema = makeExecutableSchema({
      typeDefs: `
      scalar JSON

      type TestType {
        testField: JSON!
      }

      type Other {
        something: String
      }

      type Query {
        test: TestType
        other: Other!
      }
      `,
      resolvers: {
        Other: {
          something: () => 'a',
        },
        JSON: GraphQLJSON,
      },
    });

    const output = printSchemaWithDirectives(schema);

    expect(output).toContain('scalar JSON');
    expect(output).toContain('type Other');
    expect(output).toContain('type TestType');
    expect(output).toContain('type Query');
  });

  it(`Should print directives correctly if they don't have astNode`, () => {
    const schema = new GraphQLSchema({
      directives: [new GraphQLDirective({
        name: 'dummy',
        locations: ['QUERY'],
      })]
    } as any);

    const output = printSchemaWithDirectives(schema);

    expect(output).toContain('directive @dummy on QUERY');
  });

  it('should print comments', () => {
    const schema = makeExecutableSchema({
      typeDefs: /* GraphQL */`
        """
          Test Query Comment
        """
        type Query {
          """
            Test Field Comment
          """
          foo: String
        }
      `
    });
    const output = printSchemaWithDirectives(schema);

    expect(output).toContain('Test Query Comment');
    expect(output).toContain('Test Field Comment');

  });
  it('should print transformed schema correctly', () => {

    const printedSchema = /* GraphQL */`
      type Foo {
        bar: String
      }
      type Bar {
        foo: Foo
      }
      type Query {
        bar: Bar
      }
   `;

    const schema = buildSchema(printedSchema);

    const transformedSchema = wrapSchema({
      schema,
      transforms: [
        new RenameTypes(typeName => `My${typeName}`)
      ]
    });
    const printedTransformedSchema = printSchemaWithDirectives(transformedSchema);
    expect(printedTransformedSchema).not.toContain(/* GraphQL */`type Foo`);
    expect(printedTransformedSchema).toContain(/* GraphQL */`type MyFoo`);
    expect(printedTransformedSchema).not.toContain(/* GraphQL */`type Bar`);
    expect(printedTransformedSchema).toContain(/* GraphQL */`type MyBar`);
    expect(printedTransformedSchema).not.toContain(/* GraphQL */`bar: Bar`);
    expect(printedTransformedSchema).toContain(/* GraphQL */`bar: MyBar`);
    expect(printedTransformedSchema).not.toContain(/* GraphQL */`foo: Foo`);
    expect(printedTransformedSchema).toContain(/* GraphQL */`foo: MyFoo`);
  });
  it('should print all directives', async () => {
    const typeDefs = /* GraphQL */`
        directive @SCHEMA on SCHEMA
        directive @SCALAR on SCALAR
        directive @OBJECT on OBJECT
        directive @ARGUMENT_DEFINITION on ARGUMENT_DEFINITION
        directive @FIELD_DEFINITION on FIELD_DEFINITION
        directive @INTERFACE on INTERFACE
        directive @UNION on UNION
        directive @ENUM on ENUM
        directive @ENUM_VALUE on ENUM_VALUE
        directive @INPUT_OBJECT on INPUT_OBJECT
        directive @INPUT_FIELD_DEFINITION on INPUT_FIELD_DEFINITION

        schema @SCHEMA {
          query: SomeType
        }

        scalar DateTime @SCALAR

        type SomeType @OBJECT {
          someField(someArg: Int! @ARGUMENT_DEFINITION): String @FIELD_DEFINITION
        }

        interface SomeInterface @INTERFACE {
          someField: String
        }

        union SomeUnion @UNION = SomeType

        enum SomeEnum @ENUM {
          someEnumValue @ENUM_VALUE
        }

        input SomeInputType @INPUT_OBJECT {
          someInputField: String @INPUT_FIELD_DEFINITION
          someOtherInputField: Int = 1
        }
    `;
    const schema = buildSchema(typeDefs);
    const printedSchema = printSchemaWithDirectives(schema);
    const printedSchemaLines = typeDefs.split('\n');
    for (const line of printedSchemaLines) {
      expect(printedSchema).toContain(line.trim());
    }
  })
});
