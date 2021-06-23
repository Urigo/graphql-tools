import { buildSchema, GraphQLSchema, printSchema, buildASTSchema, parse } from 'graphql';
import { assertGraphQLEnumType, assertGraphQLInputObjectType, assertGraphQLObjectType, assertGraphQLInterfaceType, assertGraphQLUnionType, assertGraphQLScalerType } from '../../testing/assertion';
import { assertSome } from '@graphql-tools/utils';
import { extractExtensionsFromSchema, mergeExtensions, applyExtensions } from '../src/extensions'

describe('extensions', () => {
  let schema: GraphQLSchema;

  beforeEach(() => {
    schema = buildSchema(/* GraphQL */`
      scalar MyScalar

      type Query {
        t(i: MyInput): MyType
      }

      input MyInput {
        foo: String
      }

      type MyType implements Node {
        id: ID!
        f: String
      }

      type MyOtherType {
        foo: String
      }

      interface Node {
        id: ID!
      }

      enum MyEnum {
        A
        B
        C
      }

      union MyUnion = MyType | MyOtherType
    `);
  })

  describe('extractExtensionsFromSchema', () => {
    it('Should extract scheme extensions', () => {
      schema.extensions = { schema: true };
      const result = extractExtensionsFromSchema(schema);
      expect(result.schemaExtensions).toEqual({ schema: true })
    });

    it('Should extract extensions correctly for all possible types', () => {
      const MyInput = schema.getType('MyInput')
      assertSome(MyInput)
      MyInput.extensions = { input: true };
      const MyType = schema.getType('MyType')
      assertSome(MyType)
      MyType.extensions = { type: true };
      const Node = schema.getType('Node')
      assertSome(Node)
      Node.extensions = { interface: true };
      const MyEnum = schema.getType('MyEnum')
      assertSome(MyEnum)
      MyEnum.extensions = { enum: true };
      const MyUnion = schema.getType('MyUnion')
      assertSome(MyUnion)
      MyUnion.extensions = { union: true };
      const MyScalar = schema.getType('MyScalar')
      assertSome(MyScalar)
      MyScalar.extensions = { scalar: true };

      const { types: extensions } = extractExtensionsFromSchema(schema);
      expect(extensions['MyInput'].extensions).toEqual({ input: true })
      expect(extensions['MyType'].extensions).toEqual({ type: true })
      expect(extensions['Node'].extensions).toEqual({ interface: true })
      expect(extensions['MyEnum'].extensions).toEqual({ enum: true })
      expect(extensions['MyUnion'].extensions).toEqual({ union: true })
      expect(extensions['MyScalar'].extensions).toEqual({ scalar: true })
    });

    it('Should extract extensions correctly for fields arguments', () => {
      const queryType = schema.getQueryType()
      assertSome(queryType)
      queryType.getFields()['t'].args[0].extensions = { fieldArg: true };

      const { types: extensions } = extractExtensionsFromSchema(schema);
      if (extensions['Query'].type !== "object") {
        throw new Error("Unexpected type.")
      }

      expect(extensions['Query'].fields['t'].arguments['i']).toEqual({ fieldArg: true })
    });

    it('Should extract extensions correctly for enum values', () => {
      const MyEnum = schema.getType('MyEnum')
      assertGraphQLEnumType(MyEnum)
      MyEnum.getValues()[0].extensions = { enumValue: true };

      const { types: extensions } = extractExtensionsFromSchema(schema);
      if (extensions['MyEnum'].type !== "enum") {
        throw new Error("Unexpected type.")
      }
      expect(extensions['MyEnum'].values['A']).toEqual({ enumValue: true });
      expect(extensions['MyEnum'].values['B']).toEqual({});
      expect(extensions['MyEnum'].values['C']).toEqual({});
    });

    it('Should extract extensions correctly for fields', () => {
      const queryType = schema.getQueryType()
      assertSome(queryType)
      queryType.getFields()['t'].extensions = { field: true };

      const { types: extensions } = extractExtensionsFromSchema(schema);
      if (extensions['Query'].type !== "object") {
        throw new Error("Unexpected type.")
      }
      expect(extensions['Query'].fields['t'].extensions).toEqual({ field: true })
    });

    it('Should extract extensions correctly for input fields', () => {
      const MyInput = schema.getType('MyInput')
      assertGraphQLInputObjectType(MyInput)
      MyInput.getFields()['foo'].extensions = { inputField: true };

      const { types: extensions } = extractExtensionsFromSchema(schema);
      if (extensions['MyInput'].type !== "input") {
        throw new Error("Unexpected type.")
      }
      expect(extensions['MyInput'].fields['foo'].extensions).toEqual({ inputField: true })
    });
  });

  describe('mergeExtensions', () => {
    it('Should merge all extensions from 2 schemas correctly', () => {
      const queryType = schema.getQueryType()
      assertSome(queryType)
      queryType.extensions = { queryTest: true };
      const secondSchema = buildSchema(/* GraphQL */`
        type Query {
          foo: String!
        }
      `);
      const secondQueryType = secondSchema.getQueryType()
      assertSome(secondQueryType)
      secondQueryType.extensions = { querySecondTest: true };

      const extensions = extractExtensionsFromSchema(schema);
      const secondExtensions = extractExtensionsFromSchema(secondSchema);
      const mergedExtensions = mergeExtensions([extensions, secondExtensions]);
      expect(mergedExtensions.types['Query'].extensions).toEqual({ queryTest: true, querySecondTest: true })
    })
  });

  describe('applyExtensionsToSchema', () => {
    it('Should re apply extensions to schema and types correctly', () => {
      schema.extensions = { schema: true };
      let MyInput = schema.getType('MyInput')
      assertGraphQLInputObjectType(MyInput)
      MyInput.extensions = { input: true };
      let MyType = schema.getType("MyType")
      assertGraphQLObjectType(MyType)
      MyType.extensions = { type: true };
      let Node = schema.getType("Node")
      assertGraphQLInterfaceType(Node)
      Node.extensions = { interface: true };
      let MyEnum = schema.getType('MyEnum')
      assertGraphQLEnumType(MyEnum)
      MyEnum.extensions = { enum: true };
      let MyUnion = schema.getType('MyUnion')
      assertGraphQLUnionType(MyUnion)
      MyUnion.extensions = { union: true };
      let MyScalar = schema.getType('MyScalar')
      assertGraphQLScalerType(MyScalar)
      MyScalar.extensions = { scalar: true };
      MyInput.getFields()['foo'].extensions = { inputField: true };
      let QueryType = schema.getQueryType();
      assertSome(QueryType)
      QueryType.getFields()['t'].extensions = { field: true };
      MyEnum.getValues()[0].extensions = { enumValue: true };
      QueryType.getFields()['t'].args[0].extensions = { fieldArg: true };

      const result = extractExtensionsFromSchema(schema);
      const cleanSchema = buildASTSchema(parse(printSchema(schema)));

      MyInput = cleanSchema.getType('MyInput')
      assertGraphQLInputObjectType(MyInput)
      // To make sure it's stripped
      expect(MyInput.extensions).toBeUndefined();

      const modifiedSchema = applyExtensions(cleanSchema, result);

      expect(modifiedSchema.extensions).toEqual({ schema: true })
      MyInput = modifiedSchema.getType('MyInput')
      assertGraphQLInputObjectType(MyInput)
      expect(MyInput.extensions).toEqual({ input: true });
      MyType = modifiedSchema.getType("MyType")
      assertGraphQLObjectType(MyType)
      expect(MyType.extensions).toEqual({ type: true });
      Node = modifiedSchema.getType("Node")
      assertGraphQLInterfaceType(Node)
      expect(Node.extensions).toEqual({ interface: true });
      MyEnum = modifiedSchema.getType('MyEnum')
      assertGraphQLEnumType(MyEnum)
      expect(MyEnum.extensions).toEqual({ enum: true });
      MyUnion = modifiedSchema.getType('MyUnion')
      assertGraphQLUnionType(MyUnion)
      expect(MyUnion.extensions).toEqual({ union: true });
      MyScalar = modifiedSchema.getType('MyScalar')
      assertGraphQLScalerType(MyScalar)
      expect(MyScalar.extensions).toEqual({ scalar: true });
      expect(MyInput.getFields()['foo'].extensions).toEqual({ inputField: true });
      QueryType = modifiedSchema.getQueryType();
      assertSome(QueryType)
      expect(QueryType.getFields()['t'].extensions).toEqual({ field: true });
      expect(MyEnum.getValues()[0].extensions).toEqual({ enumValue: true });
      expect(QueryType.getFields()['t'].args[0].extensions).toEqual({ fieldArg: true });
    });
  })
});
