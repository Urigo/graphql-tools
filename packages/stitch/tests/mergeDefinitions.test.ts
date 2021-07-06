import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';
import { getDirectives } from '@graphql-tools/utils';
import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import {
  GraphQLObjectType,
  graphql,
} from 'graphql';
import { assertGraphQLEnumType, assertGraphQLInputObjectType, assertGraphQLInterfaceType, assertGraphQLObjectType, assertGraphQLScalerType, assertGraphQLUnionType } from '../../testing/assertion';

describe('merge canonical types', () => {
  const firstSchema = makeExecutableSchema({
    typeDefs: `
      directive @mydir(value: String) on OBJECT | INTERFACE | INPUT_OBJECT | UNION | ENUM | SCALAR | FIELD_DEFINITION | INPUT_FIELD_DEFINITION

      "first"
      type Product implements IProduct @mydir(value: "first") {
        "first"
        id: ID! @mydir(value: "first") @deprecated(reason: "first")
        "first"
        url: String @mydir(value: "first") @deprecated(reason: "first")
      }

      "first"
      interface IProduct @mydir(value: "first") {
        "first"
        id: ID! @mydir(value: "first")
        "first"
        url: String @mydir(value: "first")
      }

      "first"
      input ProductInput @mydir(value: "first") {
        "first"
        id: ID @mydir(value: "first")
        "first"
        url: String @mydir(value: "first")
      }

      "first"
      enum ProductEnum @mydir(value: "first") {
        "first"
        YES
        "first"
        NO
      }

      "first"
      union ProductUnion @mydir(value: "first") = Product

      "first"
      scalar ProductScalar @mydir(value: "first")

      "first"
      type Query @mydir(value: "first") {
        "first"
        field1: String @mydir(value: "first")
        "first"
        field2: String @mydir(value: "first")
      }
    `,
    resolvers: {
      Query: {
        field1: () => 'first',
        field2: () => 'first',
      }
    }
  });

  const secondSchema = makeExecutableSchema({
    typeDefs: `
      directive @mydir(value: String) on OBJECT | INTERFACE | INPUT_OBJECT | UNION | ENUM | SCALAR | FIELD_DEFINITION | INPUT_FIELD_DEFINITION

      "second"
      type Product implements IProduct @mydir(value: "second") {
        "second"
        id: ID! @mydir(value: "second") @deprecated(reason: "second")
        "second"
        url: String @mydir(value: "second") @deprecated(reason: "second")
      }

      "second"
      interface IProduct @mydir(value: "second") {
        "second"
        id: ID! @mydir(value: "second")
        "second"
        url: String @mydir(value: "second")
      }

      "second"
      input ProductInput @mydir(value: "second") {
        "second"
        id: ID @mydir(value: "second")
        "second"
        url: String @mydir(value: "second")
      }

      "second"
      enum ProductEnum @mydir(value: "second") {
        "second"
        YES
        "second"
        NO
        "second"
        MAYBE
      }

      "second"
      union ProductUnion @mydir(value: "second") = Product

      "second"
      scalar ProductScalar @mydir(value: "second")

      "second"
      type Query @mydir(value: "second") {
        "second"
        field1: String @mydir(value: "second")
        "second"
        field2: String @mydir(value: "second")
      }
    `,
    resolvers: {
      Query: {
        field1: () => 'second',
        field2: () => 'second',
      }
    }
  });

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: firstSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: 'product',
            args: ({ id }) => ({ id }),
            canonical: true,
          },
          IProduct: {
            canonical: true,
          },
          ProductInput: {
            canonical: true,
          },
          ProductEnum: {
            canonical: true,
          },
          ProductUnion: {
            canonical: true,
          },
          ProductScalar: {
            canonical: true,
          },
          Query: {
            canonical: true,
          },
        }
      },
      {
        schema: secondSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: 'product',
            args: ({ id }) => ({ id }),
            fields: {
              url: { canonical: true },
            }
          },
          IProduct: {
            fields: {
              url: { canonical: true },
            }
          },
          ProductInput: {
            fields: {
              url: { canonical: true },
            }
          },
          Query: {
            fields: {
              field2: { canonical: true },
            }
          },
        }
      },
    ],
    typeDefs: `
      directive @mydir(value: String) on OBJECT | INTERFACE | INPUT_OBJECT | UNION | ENUM | SCALAR | FIELD_DEFINITION | INPUT_FIELD_DEFINITION

      "third"
      type Product implements IProduct @mydir(value: "third") {
        "third"
        id: ID! @mydir(value: "third")
        "third"
        url: String @mydir(value: "third")
      }

      "third"
      interface IProduct @mydir(value: "third") {
        "third"
        id: ID! @mydir(value: "third")
        "third"
        url: String @mydir(value: "third")
      }

      "third"
      input ProductInput @mydir(value: "third") {
        "third"
        id: ID @mydir(value: "third")
        "third"
        url: String @mydir(value: "third")
      }

      "third"
      enum ProductEnum @mydir(value: "third") {
        "third"
        YES
        "third"
        NO
      }

      "third"
      union ProductUnion @mydir(value: "third") = Product

      "third"
      scalar ProductScalar @mydir(value: "third")
    `
  });

  it('merges prioritized descriptions', () => {
    expect(gatewaySchema.getQueryType()?.description).toEqual('first');
    expect(gatewaySchema.getType('Product')?.description).toEqual('first');
    expect(gatewaySchema.getType('IProduct')?.description).toEqual('first');
    expect(gatewaySchema.getType('ProductInput')?.description).toEqual('first');
    expect(gatewaySchema.getType('ProductEnum')?.description).toEqual('first');
    expect(gatewaySchema.getType('ProductUnion')?.description).toEqual('first');
    expect(gatewaySchema.getType('ProductScalar')?.description).toEqual('first');

    const queryType = gatewaySchema.getQueryType();
    assertGraphQLObjectType(queryType)
    const objectType = gatewaySchema.getType('Product')
    assertGraphQLObjectType(objectType)
    const interfaceType = gatewaySchema.getType('IProduct')
    assertGraphQLInterfaceType(interfaceType)
    const inputType = gatewaySchema.getType('ProductInput');
    assertGraphQLInputObjectType(inputType)
    const enumType = gatewaySchema.getType('ProductEnum');
    assertGraphQLEnumType(enumType)

    expect(queryType.getFields()['field1'].description).toEqual('first');
    expect(queryType.getFields()['field2'].description).toEqual('second');

    expect(objectType.getFields()['id'].description).toEqual('first');
    expect(interfaceType.getFields()['id'].description).toEqual('first');
    expect(inputType.getFields()['id'].description).toEqual('first');

    expect(objectType.getFields()['url'].description).toEqual('second');
    expect(interfaceType.getFields()['url'].description).toEqual('second');
    expect(inputType.getFields()['url'].description).toEqual('second');

    expect(enumType.toConfig().values['YES'].description).toEqual('first');
    expect(enumType.toConfig().values['NO'].description).toEqual('first');
    expect(enumType.toConfig().values['MAYBE'].description).toEqual('second');
  });

  it('merges prioritized ASTs', () => {
    const queryType = gatewaySchema.getQueryType();
    assertGraphQLObjectType(queryType)
    const objectType = gatewaySchema.getType('Product');
    assertGraphQLObjectType(objectType)
    const interfaceType = gatewaySchema.getType('IProduct')
    assertGraphQLInterfaceType(interfaceType)
    const inputType = gatewaySchema.getType('ProductInput');
    assertGraphQLInputObjectType(inputType)
    const enumType = gatewaySchema.getType('ProductEnum');
    assertGraphQLEnumType(enumType)
    const unionType = gatewaySchema.getType('ProductUnion');
    assertGraphQLUnionType(unionType)
    const scalarType = gatewaySchema.getType('ProductScalar');
    assertGraphQLScalerType(scalarType)

    expect(getDirectives(firstSchema, queryType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, objectType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, interfaceType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, inputType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, enumType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, unionType.toConfig())['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, scalarType.toConfig())['mydir'].value).toEqual('first');

    expect(getDirectives(firstSchema, queryType.getFields()['field1'])['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, queryType.getFields()['field2'])['mydir'].value).toEqual('second');
    expect(getDirectives(firstSchema, objectType.getFields()['id'])['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, objectType.getFields()['url'])['mydir'].value).toEqual('second');
    expect(getDirectives(firstSchema, interfaceType.getFields()['id'])['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, interfaceType.getFields()['url'])['mydir'].value).toEqual('second');
    expect(getDirectives(firstSchema, inputType.getFields()['id'])['mydir'].value).toEqual('first');
    expect(getDirectives(firstSchema, inputType.getFields()['url'])['mydir'].value).toEqual('second');

    expect(enumType.toConfig().astNode?.values?.map(v => v.description?.value)).toEqual(['first', 'first', 'second']);
    expect(enumType.toConfig().values['YES'].astNode?.description?.value).toEqual('first');
    expect(enumType.toConfig().values['NO'].astNode?.description?.value).toEqual('first');
    expect(enumType.toConfig().values['MAYBE'].astNode?.description?.value).toEqual('second');
  });

  it('merges prioritized deprecations', () => {
    const objectType = gatewaySchema.getType('Product') as GraphQLObjectType;
    expect(objectType.getFields()['id'].deprecationReason).toEqual('first');
    expect(objectType.getFields()['url'].deprecationReason).toEqual('second');
    expect(getDirectives(firstSchema, objectType.getFields()['id'])['deprecated'].reason).toEqual('first');
    expect(getDirectives(firstSchema, objectType.getFields()['url'])['deprecated'].reason).toEqual('second');
  });

  it('promotes canonical root field definitions', async () => {
    const { data } = await graphql(gatewaySchema, '{ field1 field2 }');
    expect(data).toEqual({
      field1: 'first',
      field2: 'second',
    });
  });
});

describe('merge @canonical directives', () => {
  const { stitchingDirectivesTransformer, stitchingDirectivesTypeDefs } = stitchingDirectives();
  const firstSchema = makeExecutableSchema({
    typeDefs: `
      ${stitchingDirectivesTypeDefs}
      "first"
      type Product @canonical {
        "first"
        id: ID!
        "first"
        name: String
      }
      "first"
      input ProductInput @canonical {
        "first"
        value: ProductEnum
      }
      "first"
      enum ProductEnum @canonical {
        "first"
        YES
      }
      type Query {
        "first"
        product(input: ProductInput): Product @canonical
      }
    `
  });
  const secondSchema = makeExecutableSchema({
    typeDefs: `
      ${stitchingDirectivesTypeDefs}
      "second"
      type Product {
        "second"
        id: ID!
        "second"
        name: String @canonical
      }
      "second"
      input ProductInput {
        "second"
        value: ProductEnum @canonical
      }
      "second"
      enum ProductEnum {
        "second"
        YES
      }
      type Query {
        "second"
        product(input: ProductInput): Product
      }
    `
  });
  const gatewaySchema = stitchSchemas({
    subschemaConfigTransforms: [stitchingDirectivesTransformer],
    subschemas: [
      { schema: firstSchema },
      { schema: secondSchema },
    ],
  });

  it('merges with directive', async () => {
    const objectType = gatewaySchema.getType('Product') ;
    assertGraphQLObjectType(objectType)
    const inputType = gatewaySchema.getType('ProductInput');
    assertGraphQLInputObjectType(inputType)
    const enumType = gatewaySchema.getType('ProductEnum');
    assertGraphQLEnumType(enumType)
    const queryType = gatewaySchema.getQueryType()
    assertGraphQLObjectType(queryType)
    expect(objectType.description).toEqual('first');
    expect(inputType.description).toEqual('first');
    expect(enumType.description).toEqual('first');
    expect(queryType.getFields()['product'].description).toEqual('first');
    expect(objectType.getFields()['id'].description).toEqual('first');
    expect(objectType.getFields()['name'].description).toEqual('second');
    expect(inputType.getFields()['value'].description).toEqual('second');
  });
});
