// Conversion of Apollo Federation demo
// Compare: https://github.com/apollographql/federation-demo
// See also:
// https://github.com/ardatan/graphql-tools/issues/1697
// https://github.com/ardatan/graphql-tools/issues/1710
// https://github.com/ardatan/graphql-tools/issues/1959

import { graphql, GraphQLBoolean, GraphQLID, GraphQLInputObjectType, GraphQLInt, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString } from 'graphql';

import { ExecutionResult } from '@graphql-tools/utils';
import { stitchSchemas } from '@graphql-tools/stitch';

import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import { ValidationLevel } from '../src/types';

describe('merging using type merging', () => {
  const { stitchingDirectivesValidator, stitchingDirectivesTransformer } = stitchingDirectives();

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

  const accountsSchemaTypes = Object.create(null);

  accountsSchemaTypes._Key = new GraphQLScalarType({
    name: '_Key',
  } as any);
  accountsSchemaTypes.Query = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      me: {
        type: accountsSchemaTypes.User,
        resolve: () => users[0],
      },
      _users: {
        type: new GraphQLList(accountsSchemaTypes.User),
        args: {
          _keys: {
            type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(accountsSchemaTypes._Key)))
          },
        },
        resolve: (_root, { keys }) => keys.map((key: Record<string, any>) => users.find(u => u.id === key['id'])),
        extensions: {
          directives: {
            merge: {},
          },
        },
      }
    }),
  });

  accountsSchemaTypes.User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: GraphQLID },
      name: { type: GraphQLString },
      username: { type: GraphQLString }
    }),
    extensions: {
      directives: {
        key: {
          selectionSet: '{ id }',
        }
      }
    }
  });

  const accountsSchema = stitchingDirectivesValidator(new GraphQLSchema({
    query: accountsSchemaTypes.Query,
  }));

  const inventory = [
    { upc: '1', inStock: true },
    { upc: '2', inStock: false },
    { upc: '3', inStock: true }
  ];

  const inventorySchemaTypes = Object.create(null);
  inventorySchemaTypes.ProductKey = new GraphQLInputObjectType({
    name: 'ProductKey',
    fields: () => ({
      upc: { type: new GraphQLNonNull(GraphQLString) },
      price: { type: GraphQLInt },
      weight: { type: GraphQLInt },
    }),
  });
  inventorySchemaTypes.Product = new GraphQLObjectType({
    name: 'Product',
    fields: () => ({
      upc: { type: new GraphQLNonNull(GraphQLString) },
      inStock: { type: GraphQLBoolean },
      shippingEstimate: {
        type: GraphQLInt,
        resolve: product => {
          if (product.price > 1000) {
            return 0 // free for expensive items
          }
          return Math.round(product.weight * 0.5) || null; // estimate is based on weight
        },
        extensions: {
          directives: {
            computed: {
              selectionSet: '{ price weight }',
            }
          }
        }
      }
    }),
    extensions: {
      directives: {
        key: {
          selectionSet: '{ upc }',
        },
      },
    },
  });
  inventorySchemaTypes.Query = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      mostStockedProduct: {
        type: inventorySchemaTypes.Product,
        resolve: () => inventory.find(i => i.upc === '3'),
      },
      _products: {
        type: new GraphQLNonNull(new GraphQLList(inventorySchemaTypes.Product)),
        args: {
          keys: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(inventorySchemaTypes.ProductKey))) }
        },
        resolve: (_root, { keys }) => {
          return keys.map((key: Record<string, any>) => ({ ...key, ...inventory.find(i => i.upc === key['upc']) }));
        },
        extensions: {
          directives: {
            merge: {},
          },
        },
      },
    }),
  })
  const inventorySchema = stitchingDirectivesValidator(new GraphQLSchema({
    query: inventorySchemaTypes.Query,
  }));

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

  const productsSchemaTypes = Object.create(null);
  productsSchemaTypes.Product = new GraphQLObjectType({
    name: 'Product',
    fields: () => ({
      upc: { type: new GraphQLNonNull(GraphQLString) },
      name: { type: GraphQLString },
      price: { type: GraphQLInt },
      weight: { type: GraphQLInt },
    }),
    // key is not necessary when using keyField
    //
    // extensions: {
    //   directives: {
    //     key: {
    //       selectionSet: '{ upc }',
    //     },
    //   },
    // },
  });

  productsSchemaTypes.Query = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      topProducts: {
        type: new GraphQLList(productsSchemaTypes.Product),
        args: {
          first: {
            type: GraphQLInt,
            defaultValue: 2,
          },
        },
        resolve: (_root, args) => products.slice(0, args['first']),
      },
      _productsByUpc: {
        type: new GraphQLList(productsSchemaTypes.Product),
        args: {
          upcs: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(GraphQLString))) },
        },
        resolve: (_root, { upcs }) => upcs.map((upc: any) => products.find(product => product.upc === upc)),
        extensions: {
          directives: {
            merge: {
              keyField: 'upc',
            },
          },
        },
      },
    }),
  })

  const productsSchema = stitchingDirectivesValidator(new GraphQLSchema({
    query: productsSchemaTypes.Query,
  }));

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

  const reviewsSchemaTypes = Object.create(null);
  reviewsSchemaTypes.Review = new GraphQLObjectType({
    name: 'Review',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      body: { type: GraphQLString },
      author: {
        type: reviewsSchemaTypes.User,
        resolve: (review) => ({ __typename: 'User', id: review.authorId }),
      },
      product: { type: reviewsSchemaTypes.Product },
    }),
  });

  reviewsSchemaTypes.UserKey = new GraphQLInputObjectType({
    name: 'UserKey',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
    }),
  });

  reviewsSchemaTypes.User = new GraphQLObjectType({
    name: 'User',
    fields: () => ({
      id: { type: new GraphQLNonNull(GraphQLID) },
      username: {
        type: GraphQLString,
        resolve: (user) => {
          const found = usernames.find(username => username.id === user.id)
          return found ? found.username : null
        },
      },
      numberOfReviews: {
        type: GraphQLInt,
        resolve: (user) => reviews.filter(review => review.authorId === user.id).length,
      },
      reviews: {
        type: new GraphQLList(reviewsSchemaTypes.Review),
        resolve: (user) => reviews.filter(review => review.authorId === user.id),
      },
    }),
    extensions: {
      directives: {
        key: {
          selectionSet: '{ id }',
        },
      },
    },
  });

  reviewsSchemaTypes.ProductKey = new GraphQLInputObjectType({
    name: 'ProductKey',
    fields: () => ({
      upc: { type: new GraphQLNonNull(GraphQLString) },
    }),
  });

  reviewsSchemaTypes.ProductInput = new GraphQLInputObjectType({
    name: 'ProductInput',
    fields: () => ({
      keys: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(reviewsSchemaTypes.ProductKey))) },
    }),
  });

  reviewsSchemaTypes.Product = new GraphQLObjectType({
    name: 'Product',
    fields: () => ({
      upc: { type: new GraphQLNonNull(GraphQLString) },
      reviews: {
        type: new GraphQLList(reviewsSchemaTypes.Review),
        resolve: (product) => reviews.filter(review => review.product.upc === product.upc)
      },
    }),
    extensions: {
      directives: {
        key: {
          selectionSet: '{ upc }',
        },
      },
    },
  });

  reviewsSchemaTypes.Query = new GraphQLObjectType({
    name: 'Query',
    fields: () => ({
      _reviews: {
        type: reviewsSchemaTypes.Review,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) },
        },
        resolve: (_root, { id }) => reviews.find(review => review.id === id),
      },
      _users: {
        type: new GraphQLList(reviewsSchemaTypes.User),
        args: {
          keys: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(reviewsSchemaTypes.UserKey))) },
        },
        resolve: (_root, { keys }) => keys,
        extensions: {
          directives: {
            merge: {},
          },
        },
      },
      _products: {
        type: new GraphQLList(reviewsSchemaTypes.Product),
        args: {
          productInput: { type: reviewsSchemaTypes.ProductInput },
        },
        resolve: (_root, { input }) => input.keys,
        extensions: {
          directives: {
            merge: {
              keyArg: 'input.keys',
            },
          },
        },
      },
    }),
  });

  const reviewsSchema = stitchingDirectivesValidator(new GraphQLSchema({
    query: reviewsSchemaTypes.Query,
  }));

  const stitchedSchema = stitchSchemas({
    subschemas: [
      {
        schema: accountsSchema,
        batch: true,
      },
      {
        schema: inventorySchema,
        batch: true,
      },
      {
        schema: productsSchema,
        batch: true,
      },
      {
        schema: reviewsSchema,
        batch: true,
      }],
    subschemaConfigTransforms: [stitchingDirectivesTransformer],
    typeMergingOptions: {
      validationSettings: { validationLevel: ValidationLevel.Off }
    }
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
