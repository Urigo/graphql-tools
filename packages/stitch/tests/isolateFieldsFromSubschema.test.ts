import { makeExecutableSchema } from '@graphql-tools/schema';
import { isolateFieldsFromSubschema } from '@graphql-tools/stitch';
import { Subschema } from '@graphql-tools/delegate';

describe('isolateFieldsFromSubschema', () => {
  describe('basic isolation', () => {
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
      `
    });

    it('splits a subschema into static and computed portions', async () => {
      const [staticConfig, computedConfig] = isolateFieldsFromSubschema({
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id weight }',
            fields: {
              shippingEstimate: { selectionSet: '{ price }' },
            },
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      });

      expect(Object.keys(computedConfig.schema.getType('Query').getFields())).toEqual(['_products']);
      expect(Object.keys(computedConfig.schema.getType('Product').getFields())).toEqual(['shippingEstimate']);
      expect(computedConfig.schema.getType('DeliveryService')).toBeUndefined();
      expect(computedConfig.schema.getType('Storefront')).toBeUndefined();
      expect(computedConfig.schema.getType('ProductRepresentation')).toBeDefined();
      expect(computedConfig.merge.Product.fields).toEqual({
        shippingEstimate: { selectionSet: '{ price }' },
      });

      expect(Object.keys(staticConfig.schema.getType('Query').getFields())).toEqual(['storefront', '_products']);
      expect(Object.keys(staticConfig.schema.getType('Product').getFields())).toEqual(['id', 'deliveryService']);
      expect(staticConfig.schema.getType('DeliveryService')).toBeDefined();
      expect(staticConfig.schema.getType('Storefront')).toBeDefined();
      expect(staticConfig.schema.getType('ProductRepresentation')).toBeDefined();
    });

    it('does not split schemas with only static fields', async () => {
      const subschemas = isolateFieldsFromSubschema({
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id price weight }',
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      });

      expect(subschemas.length).toEqual(1);
    });
  });

  describe('from SDL directives', () => {
    const storefrontSchema = makeExecutableSchema({
      typeDefs: `
        directive @requires(selectionSet: String) on FIELD_DEFINITION
        type Product {
          id: ID!
          shippingEstimate: Float! @requires(selectionSet: "{ price weight }")
          deliveryService: DeliveryService! @requires(selectionSet: "{ weight }")
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
      `
    });

    it('splits a subschema into static and computed portions', async () => {
      const [staticConfig, computedConfig] = isolateFieldsFromSubschema(new Subschema({
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      }));

      const productFields = computedConfig.schema.getType('Product').getFields();
      expect(Object.keys(productFields)).toEqual(['shippingEstimate', 'deliveryService']);
      expect(productFields.shippingEstimate).toBeDefined();
      expect(productFields.deliveryService).toBeDefined();
      expect(computedConfig.merge.Product.fields).toEqual({
        shippingEstimate: { selectionSet: '{ price weight }' },
        deliveryService: { selectionSet: '{ weight }' },
      });

      expect(Object.keys(staticConfig.schema.getType('Product').getFields())).toEqual(['id']);
    });
  });

  describe('fully computed type', () => {
    const storefrontSchema = makeExecutableSchema({
      typeDefs: `
        type Product {
          computedOne: String!
          computedTwo: String!
        }
        type Query {
          _products(representations: [ID!]!): [Product]!
        }
      `
    });

    it('does not reprocess already isolated computations', async () => {
      const subschemas = isolateFieldsFromSubschema({
        schema: storefrontSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fields: {
              computedOne: { selectionSet: '{ price weight }' },
              computedTwo: { selectionSet: '{ weight }' },
            },
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      });

      expect(subschemas.length).toEqual(1);
    });
  });

  describe('multiple computed types', () => {
    const storefrontSchema = makeExecutableSchema({
      typeDefs: `
        type Product {
          static: String!
          computed: String!
        }
        type Storefront {
          static: ID!
          computed: [Product]!
        }
        type Query {
          storefront(id: ID!): Storefront
          _products(representations: [ID!]!): [Product]!
        }
      `
    });

    it('moves all computed types to the computed schema', async () => {
      const [staticConfig, computedConfig] = isolateFieldsFromSubschema({
        schema: storefrontSchema,
        merge: {
          Storefront: {
            selectionSet: '{ id }',
            fields: {
              computed: { selectionSet: '{ availableProductIds }' },
            },
            fieldName: 'storefront',
            args: ({ id }) => ({ id }),
          },
          Product: {
            selectionSet: '{ id weight }',
            fields: {
              computed: { selectionSet: '{ price }' },
            },
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      });

      expect(Object.keys(computedConfig.schema.getType('Query').getFields())).toEqual(['storefront', '_products']);
      expect(Object.keys(computedConfig.schema.getType('Product').getFields())).toEqual(['computed']);
      expect(Object.keys(computedConfig.schema.getType('Storefront').getFields())).toEqual(['computed']);
      expect(computedConfig.merge.Storefront.fields).toEqual({
        computed: { selectionSet: '{ availableProductIds }' },
      });
      expect(computedConfig.merge.Product.fields).toEqual({
        computed: { selectionSet: '{ price }' },
      });

      expect(Object.keys(staticConfig.schema.getType('Query').getFields())).toEqual(['storefront', '_products']);
      expect(Object.keys(staticConfig.schema.getType('Product').getFields())).toEqual(['static']);
      expect(Object.keys(staticConfig.schema.getType('Storefront').getFields())).toEqual(['static']);
      expect(staticConfig.merge.Storefront.fields).toBeUndefined();
    });
  });

  describe('with computed interface fields', () => {
    it('shifts computed interface fields into computed schema', async () => {
      const testSchema = makeExecutableSchema({
        typeDefs: `
          interface IProduct {
            static: String!
            computed: String!
          }
          type Product implements IProduct {
            static: String!
            computed: String!
          }
          type Query {
            _products(representations: [ID!]!): [Product]!
          }
        `
      });

      const [staticConfig, computedConfig] = isolateFieldsFromSubschema({
        schema: testSchema,
        merge: {
          Product: {
            selectionSet: '{ id }',
            fields: {
              computed: { selectionSet: '{ price weight }' }
            },
            fieldName: '_products',
            key: ({ id, price, weight }) => ({ id, price, weight }),
            argsFromKeys: (representations) => ({ representations }),
          }
        }
      });

      expect(Object.keys(computedConfig.schema.getType('IProduct').getFields())).toEqual(['computed']);
      expect(Object.keys(computedConfig.schema.getType('Product').getFields())).toEqual(['computed']);
      expect(Object.keys(staticConfig.schema.getType('IProduct').getFields())).toEqual(['static']);
      expect(Object.keys(staticConfig.schema.getType('Product').getFields())).toEqual(['static']);
    });
  });
});
