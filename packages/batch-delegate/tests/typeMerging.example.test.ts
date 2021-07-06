// Conversion of Apollo Federation demo
// Compare: https://github.com/apollographql/federation-demo
// See also:
// https://github.com/ardatan/graphql-tools/issues/1697
// https://github.com/ardatan/graphql-tools/issues/1710
// https://github.com/ardatan/graphql-tools/issues/1959

import { graphql } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { ExecutionResult } from '@graphql-tools/utils';
import { stitchSchemas } from '@graphql-tools/stitch';

describe('merging using type merging', () => {
  const users = [
    {
      id: '1',
      name: 'Ada Lovelace',
      birthDate: '1815-12-10',
      username: '@ada'
    },
    {
      id: '2',
      name: 'Alan Turing',
      birthDate: '1912-06-23',
      username: '@complete',
    },
  ];

  const accountsSchema = makeExecutableSchema({
    typeDefs: `
      type Query {
        me: User
        _userById(id: ID!): User
        _usersById(ids: [ID!]!): [User]
      }
      type User {
        id: ID!
        name: String
        username: String
      }
    `,
    resolvers: {
      Query: {
        me: () => users[0],
        _userById: (_root, { id }) => users.find(user => user.id === id),
        _usersById: (_root, { ids }) => ids.map((id: any) => users.find(user => user.id === id)),
      },
    },
  });

  const inventory = [
    { upc: '1', inStock: true },
    { upc: '2', inStock: false },
    { upc: '3', inStock: true }
  ];

  const inventorySchema = makeExecutableSchema({
    typeDefs: `
      input ProductRepresentation {
        upc: String!
        price: Int
        weight: Int
      }
      type Product {
        upc: String!
        inStock: Boolean
        shippingEstimate: Int
      }
      type Query {
        mostStockedProduct: Product
        _products(representations: [ProductRepresentation!]!): [Product]!
      }
    `,
    resolvers: {
      Product: {
        shippingEstimate: product => {
          if (product.price > 1000) {
            return 0 // free for expensive items
          }
          return Math.round(product.weight * 0.5) || null; // estimate is based on weight
        }
      },
      Query: {
        mostStockedProduct: () => inventory.find(i => i.upc === '3'),
        _products: (_root, { representations }) => {
          return representations.map((rep: Record<string, any>) => ({ ...rep, ...inventory.find(i => i.upc === rep['upc']) }));
        },
      },
    },
  });

  const products = [
    {
      upc: '1',
      name: 'Table',
      price: 899,
      weight: 100
    },
    {
      upc: '2',
      name: 'Couch',
      price: 1299,
      weight: 1000
    },
    {
      upc: '3',
      name: 'Chair',
      price: 54,
      weight: 50
    }
  ];

  const productsSchema = makeExecutableSchema({
    typeDefs: `
      type Query {
        topProducts(first: Int = 2): [Product]
        _productByUpc(upc: String!): Product
        _productsByUpc(upcs: [String!]!): [Product]
      }
      type Product {
        upc: String!
        name: String
        price: Int
        weight: Int
      }
    `,
    resolvers: {
      Query: {
        topProducts: (_root, args) => products.slice(0, args.first),
        _productByUpc: (_root, { upc }) => products.find(product => product.upc === upc),
        _productsByUpc: (_root, { upcs }) => upcs.map((upc: any) => products.find(product => product.upc === upc)),
      }
    },
  });

  const usernames = [
    { id: '1', username: '@ada' },
    { id: '2', username: '@complete' },
  ];

  const reviews = [
    {
      id: '1',
      authorId: '1',
      product: { upc: '1' },
      body: 'Love it!',
    },
    {
      id: '2',
      authorId: '1',
      product: { upc: '2' },
      body: 'Too expensive.',
    },
    {
      id: '3',
      authorId: '2',
      product: { upc: '3' },
      body: 'Could be better.',
    },
    {
      id: '4',
      authorId: '2',
      product: { upc: '1' },
      body: 'Prefer something else.',
    },
  ];

  const reviewsSchema = makeExecutableSchema({
    typeDefs: `
      type Review {
        id: ID!
        body: String
        author: User
        product: Product
      }
      type User {
        id: ID!
        username: String
        numberOfReviews: Int
        reviews: [Review]
      }
      type Product {
        upc: String!
        reviews: [Review]
      }
      type Query {
        _userById(id: ID!): User
        _usersById(ids: [ID!]!): [User]
        _reviewById(id: ID!): Review
        _productByUpc(upc: String!): Product
        _productsByUpc(upcs: [String!]!): [Product]
      }
    `,
    resolvers: {
      Review: {
        author: (review) => ({ __typename: 'User', id: review.authorId }),
      },
      User: {
        reviews: (user) => reviews.filter(review => review.authorId === user.id),
        numberOfReviews: (user) => reviews.filter(review => review.authorId === user.id).length,
        username: (user) => {
          const found = usernames.find(username => username.id === user.id)
          return found ? found.username : null
        },
      },
      Product: {
        reviews: (product) => reviews.filter(review => review.product.upc === product.upc),
      },
      Query: {
        _reviewById: (_root, { id }) => reviews.find(review => review.id === id),
        _userById: (_root, { id }) => ({ id }),
        _usersById: (_root, { ids }) => ids.map((id: string) => ({ id })),
        _productByUpc: (_, { upc }) => ({ upc }),
        _productsByUpc: (_, { upcs }) => upcs.map((upc: string) => ({ upc })),
      },
    }
  });

  const stitchedSchema = stitchSchemas({
    subschemas: [
      {
        schema: accountsSchema,
        merge: {
          User: {
            selectionSet: '{ id }',
            fieldName: '_userById',
            args: ({ id }) => ({ id })
          }
        },
        batch: true,
      },
      {
        schema: inventorySchema,
        merge: {
          Product: {
            selectionSet: '{ upc }',
            fields: {
              shippingEstimate: {
                selectionSet: '{ price weight }',
                computed: true,
              },
            },
            fieldName: '_products',
            key: ({ upc, weight, price }) => ({ upc, weight, price }),
            argsFromKeys: (representations) => ({ representations }),
          }
        },
        batch: true,
      },
      {
        schema: productsSchema,
        merge: {
          Product: {
            selectionSet: '{ upc }',
            fieldName: '_productByUpc',
            args: ({ upc }) => ({ upc }),
          }
        },
        batch: true,
      },
      {
        schema: reviewsSchema,
        merge: {
          User: {
            selectionSet: '{ id }',
            fieldName: '_usersById',
            argsFromKeys: (ids) => ({ ids }),
            key: ({ id }) => id,
          },
          Product: {
            selectionSet: '{ upc }',
            fieldName: '_productByUpc',
            args: ({ upc }) => ({ upc }),
          },
        },
        batch: true,
      }],
  });

  test('can stitch from products to inventory schema including mixture of computed and non-computed fields', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query {
          topProducts {
            upc
            inStock
            shippingEstimate
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult: ExecutionResult = {
      data: {
        topProducts: [{
          upc: '1',
          inStock: true,
          shippingEstimate: 50,
        }, {
          upc: '2',
          inStock: false,
          shippingEstimate: 0,
        }],
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('can stitch from accounts to reviews to products to inventory', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query {
          me {
            reviews {
              product {
                upc
                price
                weight
              }
            }
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult: ExecutionResult = {
      data: {
        me: {
          reviews: [
            { product: { price: 899, upc: '1', weight: 100 } },
            { product: { price: 1299, upc: '2', weight: 1000 } },
          ],
        }
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('can stitch from accounts to reviews to products to inventory', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query {
          me {
            reviews {
              product {
                upc
                price
                weight
                shippingEstimate
              }
            }
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult: ExecutionResult = {
      data: {
        me: {
          reviews: [
            {
              product: {
                price: 899,
                upc: '1',
                weight: 100,
                shippingEstimate: 50,
              },
            },
            {
              product: {
                price: 1299,
                upc: '2',
                weight: 1000,
                shippingEstimate: 0,
              }
            },
          ],
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('can stitch from accounts to reviews to products to inventory even when entire key not requested', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query {
          me {
            reviews {
              product {
                upc
                shippingEstimate
              }
            }
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult: ExecutionResult = {
      data: {
        me: {
          reviews: [
            {
              product: {
                upc: '1',
                shippingEstimate: 50,
              },
            },
            {
              product: {
                upc: '2',
                shippingEstimate: 0,
              }
            },
          ],
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('can stitch from inventory to products and then back to inventory', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query {
          mostStockedProduct {
            upc
            inStock
            shippingEstimate
          }
        }
      `,
      undefined,
      {},
    );

    const expectedResult: ExecutionResult = {
      data: {
        mostStockedProduct: {
          upc: '3',
          inStock: true,
          shippingEstimate: 25,
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });
});
