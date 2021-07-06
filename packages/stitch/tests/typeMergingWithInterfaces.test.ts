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

import { stitchingDirectives } from '@graphql-tools/stitching-directives';
import { ValidationLevel } from '../src/types';

describe('merging using type merging', () => {
  const { allStitchingDirectivesTypeDefs, stitchingDirectivesValidator, stitchingDirectivesTransformer } = stitchingDirectives();

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
    // @merge directive will direct the gateway to use the tagged resolver to resolve objects
    // of that type. By default:
    // 1. the key for that type will be sent to the resolvers first argument.
    // 2. an array of keys will sent if the resolver returns a list.
    //
    // Note: the subschema can rely on the gateway correctly sending the indicated key and
    // so it is safe to use a non-validated scalar argument. In the next example, the subschema
    // will choose to strongly type the `keys` argument, but it is not strictly necessary.
    typeDefs: `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key
      union _Entity = User
      type Query {
        me: User
        _entities(keys: [_Key!]!): [_Entity] @merge
      }
      type User @key(selectionSet: "{ id }") {
        id: ID!
        name: String
        username: String
      }
    `,
    resolvers: {
      Query: {
        me: () => users[0],
        _entities: (_root, { keys }) => {
          return keys.map((key: Record<string, any>) => ({ ...key,  ...users.find(u => u.id === key['id']) }));
        },
      },
    },
    schemaTransforms: [stitchingDirectivesValidator],
  });

  const inventory = [
    { upc: '1', inStock: true },
    { upc: '2', inStock: false },
    { upc: '3', inStock: true }
  ];

  const inventorySchema = makeExecutableSchema({
    // @merge directive will direct the gateway to use the tagged resolver to resolve objects
    // of that type. By default:
    // 1. the key for that type will be sent to the resolvers first argument.
    // 2. an array of keys will sent if the resolver returns a list.
    //
    // In this example, the key is constructed by using @key and @computed selection sets.
    // The @computed directive for a given field instructs the gateway to only add the required
    // additional selections when the tagged field is included within a query. In addition,
    // the @computed directive will defer resolution of these fields even when queries originate
    // within this subschema. The resolver for the mostStockedProduct therefore correctly returns
    // an object with a `upc` property, but without `price` and `weight`. The gateway will use
    // the `upc` to retrieve the `price` and `weight` from the external services and return to this
    // service for the `shippingEstimate`. Resolution for @computed fields thereby differs when
    // querying via the gateway versus when querying the subservice directly.
    //
    // Note as well how the merging resolver used by the gateway includes the `price` and `weight`
    // from the key within its internal representation of a Product even though they are not
    // by this subschema.
    //
    // This example strongly types the ProductKey using an input object. This is optional,
    // as the subschema can rely on the gateway always sending in the correctly typed data.
    // It is typed correctly; `upc` is always specified, but `price` and `weight` will only
    // be included when `shippingEstimate` is included within the query.
    //
    typeDefs: `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key
      union _Entity = Product
      type Product @key(selectionSet: "{ upc }") {
        upc: String!
        inStock: Boolean
        shippingEstimate: Int @computed(selectionSet: "{ price weight }")
      }
      type Query {
        mostStockedProduct: Product
        _entities(keys: [_Key!]!): [_Entity]! @merge
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
        _entities: (_root, { keys }) => {
          return keys.map((key: Record<string, any>) => ({ ...key, ...inventory.find(i => i.upc === key['upc']) }));
        },
      },
    },
    schemaTransforms: [stitchingDirectivesValidator],
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
    // @merge directive will direct the gateway to use the tagged resolver to resolve objects
    // of that type. By default:
    // 1. the key for that type will be sent to the resolvers first argument.
    // 2. an array of keys will sent if the resolver returns a list.
    //
    // In this example, the `keyField` argument for the @merge directive is used to customize
    // the portion of the key that the gateway will pass to the resolver.
    //
    // Alternatively, the `argsExpr` argument can be used to allow more customization:
    //
    // Rules for evaluation of these arguments are as follows:
    //
    // A. any expression enclosed by double brackets will be evaluated once for each of the
    //    requested keys, and then sent as a list.
    // B. selections from the key can be referenced by using the $ sign and dot notation, so that
    //    $key.upc refers to the `upc` field of the key.
    //
    typeDefs: `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key
      union _Entity = Product
      type Query {
        topProducts(first: Int = 2): [Product]
        _entities(keys: [_Key!]!): [_Entity] @merge
      }
      type Product @key(selectionSet: "{ upc }") {
        upc: String!
        name: String
        price: Int
        weight: Int
      }
    `,
    resolvers: {
      Query: {
        topProducts: (_root, args) => products.slice(0, args.first),
        _entities: (_root, { keys }) => {
          return keys.map((key: Record<string, any>) => ({ ...key, ...products.find(product => product.upc === key['upc']) }));
        }
      }
    },
    schemaTransforms: [stitchingDirectivesValidator],
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
    // @merge directive will direct the gateway to use the tagged resolver to resolve objects
    // of that type. By default:
    // 1. the key for that type will be sent to the resolvers first argument.
    // 2. an array of keys will sent if the resolver returns a list.
    //
    // In this example, the `keyArg` argument for the @merge directive is used to set the
    // argument to which the gateway will pass the key.
    //
    // The equivalent `argsExpr` is also included. This example highlights how when using
    // `argsExpr`, the $ sign without dot notation will pass the entire key as an object.
    // This allows arbitrary nesting of the key input as needed.
    //
    typeDefs: `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key
      union _Entity = User | Product | Review
      type Review {
        id: ID!
        body: String
        author: User
        product: Product
      }
      type User @key(selectionSet: "{ id }") {
        id: ID!
        username: String
        numberOfReviews: Int
        reviews: [Review]
      }
      type Product @key(selectionSet: "{ upc }") {
        upc: String!
        reviews: [Review]
      }
      type Query {
        _entities(keys: [_Key!]!): [_Entity] @merge
      }
    `,
    resolvers: {
      Review: {
        author: (review) => ({ id: review.authorId }),
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
        _entities: (_root, { keys }) => {
          return keys.map((key: Record<string, any>) => {
            if (key['__typename'] === 'Review') {
              return ({ ...key, ...reviews.find(review => review.id === key['id']) });
            }

            return { ...key };
          });
        },
      },
    },
    schemaTransforms: [stitchingDirectivesValidator],
  });

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
