import { makeExecutableSchema } from '@graphql-tools/schema';
import { Subschema } from '@graphql-tools/delegate';
import { stitchSchemas } from '@graphql-tools/stitch';
import { graphql } from 'graphql';

const productSchema = makeExecutableSchema({
  typeDefs: `
    type Product {
      id: ID!
      price: Float!
      weight: Int!
    }

    type Query {
      product(id: ID!): Product
    }
  `,
  resolvers: {
    Query: {
      product: (root, { id }) => ({ id, price: Number(id) + 0.99, weight: Number(id) }),
    }
  }
});

describe('merge computed fields with static config', () => {
  const storefrontSchema = makeExecutableSchema({
    typeDefs: `
      type Product {
        id: ID!
        shippingEstimate: Float!
        deliveryService: DeliveryService!
      }
      enum DeliveryService {
        POSTAL
        FREIGHT
      }
      type Storefront {
        id: ID!
        availableProducts: [Product]!
      }
      input ProductRepresentation {
        id: ID!
        price: Float
        weight: Int
      }
      type Query {
        storefront(id: ID!): Storefront
        _products(representations: [ProductRepresentation!]!): [Product]!
      }
    `,
    resolvers: {
      Query: {
        storefront: (root, { id }) => ({ id, availableProducts: [{ id: '23' }] }),
        _products: (root, { representations }) => representations,
      },
      Product: {
        shippingEstimate: (obj) => obj.price > 50 ? 0 : obj.weight / 2,
        deliveryService: (obj) => obj.weight > 50 ? 'FREIGHT' : 'POSTAL',
      }
    }
  });

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: productSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: 'product',
            args: ({ id }) => ({ id }),
          }
        }
      },
      {
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fields: {
              shippingEstimate: { selectionSet: '{ price weight }', isolate: true },
              deliveryService: { selectionSet: '{ weight }', isolate: true },
            },
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      }
    ],
    mergeTypes: true,
  });

  it('collects dynamic fields via the gateway', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        product(id: 77) {
          id
          price
          weight
          shippingEstimate
          deliveryService
        }
      }
    `);

    expect(data.product).toEqual({
      id: '77',
      price: 77.99,
      weight: 77,
      shippingEstimate: 0,
      deliveryService: 'FREIGHT'
    });
  });

  it('collects dynamic fields via a subservice', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        storefront(id: 77) {
          availableProducts {
            id
            price
            weight
            shippingEstimate
            deliveryService
          }
        }
      }
    `);

    expect(data.storefront.availableProducts).toEqual([
      {
        id: '23',
        price: 23.99,
        weight: 23,
        shippingEstimate: 11.5,
        deliveryService: 'POSTAL'
      }
    ]);
  });
});

describe('merge computed fields from SDL via federation entities', () => {
  const storefrontSchema = makeExecutableSchema({
    typeDefs: `
      directive @requires(selectionSet: String, isolate: Boolean) on FIELD_DEFINITION

      type Product {
        id: ID!
        shippingEstimate: Float! @requires(selectionSet: "{ price weight }", isolate: true)
        deliveryService: DeliveryService! @requires(selectionSet: "{ weight }", isolate: true)
      }
      enum DeliveryService {
        POSTAL
        FREIGHT
      }
      type Storefront {
        id: ID!
        availableProducts: [Product]!
      }
      scalar _Any
      union _Entity = Product
      type Query {
        storefront(id: ID!): Storefront
        _entities(representations: [_Any!]!): [_Entity]!
      }
    `,
    resolvers: {
      Query: {
        storefront: (root, { id }) => ({ id, availableProducts: [{ id: '23' }] }),
        _entities: (root, { representations }) => representations,
      },
      Product: {
        shippingEstimate: (obj) => obj.price > 50 ? 0 : obj.weight / 2,
        deliveryService: (obj) => obj.weight > 50 ? 'FREIGHT' : 'POSTAL',
      }
    }
  });

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: productSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: 'product',
            args: ({ id }) => ({ id }),
          }
        }
      },
      new Subschema({
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: '_entities',
            key: ({ id, price, weight }) => ({ id, price, weight, __typename: 'Product' }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      }),
    ],
    mergeTypes: true,
  });

  it('collects dynamic fields via subservice origin', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        storefront(id: 77) {
          availableProducts {
            id
            price
            weight
            shippingEstimate
            deliveryService
          }
        }
      }
    `);

    expect(data.storefront.availableProducts).toEqual([
      {
        id: '23',
        price: 23.99,
        weight: 23,
        shippingEstimate: 11.5,
        deliveryService: 'POSTAL'
      }
    ]);
  });
});
