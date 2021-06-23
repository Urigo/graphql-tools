import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertSome } from '@graphql-tools/utils';
import { stitchSchemas } from '../src/stitchSchemas';

describe('merge on multiple keys', () => {
  const catalogSchema = makeExecutableSchema({
    typeDefs: `
      type Product {
        upc: ID!
        name: String
      }
      type Query {
        productsByUpc(upcs: [ID!]!): [Product]!
      }
    `,
    resolvers: {
      Query: {
        productsByUpc: () => [{ upc: '1', name: 'Table' }],
      }
    }
  });

  const vendorSchema = makeExecutableSchema({
    typeDefs: `
      type Product {
        id: ID!
        upc: ID!
        price: Int
      }
      input ProductKey {
        id: ID
        upc: ID
      }
      type Query {
        productsByKey(keys: [ProductKey!]!): [Product]!
      }
    `,
    resolvers: {
      Query: {
        productsByKey: () => [{ id: '101', upc: '1', price: 879 }],
      }
    }
  });

  const reviewsSchema = makeExecutableSchema({
    typeDefs: `
      type Product {
        id: ID!
        reviews: [String]
      }
      type Query {
        productsById(ids: [ID!]!): [Product]!
      }
    `,
    resolvers: {
      Query: {
        productsById: () => [{ id: '101', reviews: ['works!'] }],
      }
    }
  });

  const gatewaySchema = stitchSchemas({
    subschemas: [
      {
        schema: catalogSchema,
        merge: {
          Product: {
            selectionSet: '{ upc }',
            fieldName: 'productsByUpc',
            key: ({ upc }) => upc,
            argsFromKeys: (upcs) => ({ upcs }),
          }
        }
      },
      {
        schema: vendorSchema,
        merge: {
          Product: {
            entryPoints: [{
              selectionSet: '{ upc }',
              fieldName: 'productsByKey',
              key: ({ upc }) => ({ upc }),
              argsFromKeys: (keys) => ({ keys }),
            }, {
              selectionSet: '{ id }',
              fieldName: 'productsByKey',
              key: ({ id }) => ({ id }),
              argsFromKeys: (keys) => ({ keys }),
            }],
          }
        }
      },
      {
        schema: reviewsSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: 'productsById',
            key: ({ id }) => id,
            argsFromKeys: (ids) => ({ ids }),
          }
        }
      }
    ]
  });

  const result = [{
    id: '101',
    upc: '1',
    name: 'Table',
    price: 879,
    reviews: ['works!'],
  }];

  test('works from middle join outward', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        productsByKey(keys: [{ id: "101" }]) {
          id
          upc
          name
          price
          reviews
        }
      }
    `);
    assertSome(data)
    expect(data.productsByKey).toEqual(result);
  });

  test('works from upc -> join -> id', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        productsByUpc(upcs: ["1"]) {
          id
          upc
          name
          price
          reviews
        }
      }
    `);
    assertSome(data)
    expect(data.productsByUpc).toEqual(result);
  });

  test('works from id -> join -> upc', async () => {
    const { data } = await graphql(gatewaySchema, `
      query {
        productsById(ids: ["101"]) {
          id
          upc
          name
          price
          reviews
        }
      }
    `);
    assertSome(data)
    expect(data.productsById).toEqual(result);
  });
});
