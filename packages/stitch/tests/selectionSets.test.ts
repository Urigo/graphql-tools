import { graphql } from 'graphql';

import { delegateToSchema } from '@graphql-tools/delegate';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { assertSome, IResolvers } from '@graphql-tools/utils';

import { stitchSchemas } from '../src/stitchSchemas';

import {
  propertySchema,
  bookingSchema,
  sampleData,
  Property,
} from './fixtures/schemas';

describe('delegateToSchema ', () => {
  test('should add selection sets for deep types', async () => {
    function findPropertyByLocationName(
      properties: Record<string, Property>,
      name: string,
    ): Property | undefined {
      for (const key of Object.keys(properties)) {
        const property = properties[key];
        if (property.location.name === name) {
          return property;
        }
      }
    }

    const COORDINATES_QUERY = `
      query BookingCoordinates($bookingId: ID!) {
        bookingById (id: $bookingId) {
          property {
            location {
              coordinates
            }
          }
        }
      }
    `;

    const proxyResolvers: IResolvers = {
      Booking: {
        property: {
          selectionSet: '{ propertyId }',
          resolve(booking, _args, context, info) {
            return delegateToSchema({
              schema: propertySchema,
              operation: 'query',
              fieldName: 'propertyById',
              args: { id: booking.propertyId },
              context,
              info,
            });
          },
        },
      },
      Location: {
        coordinates: {
          selectionSet: '{ name }',
          resolve: (location) => {
            const name = location.name;
            return findPropertyByLocationName(sampleData.Property, name)?.location
              .coordinates;
          },
        },
      },
    };

    const proxyTypeDefs = `
      extend type Booking {
        property: Property!
      }
      extend type Location {
        coordinates: String!
      }
    `;

    const schema = stitchSchemas({
      subschemas: [bookingSchema, propertySchema],
      typeDefs: proxyTypeDefs,
      resolvers: proxyResolvers,
    });

    const result = await graphql(
      schema,
      COORDINATES_QUERY,
      {},
      {},
      { bookingId: 'b1' },
    );

    expect(result).toEqual({
      data: {
        bookingById: {
          property: {
            location: {
              coordinates: sampleData.Property.p1.location.coordinates,
            },
          },
        },
      },
    });
  });

  describe('should add selection sets for fragments', () => {
    const networkSchema = makeExecutableSchema({
      typeDefs: `
          interface Domain {
            id: ID!
            name: String!
          }
          type Domain1 implements Domain {
            id: ID!
            name: String!
          }
          type Domain2 implements Domain {
            id: ID!
            name: String!
            extra: String!
          }
          type Network {
            id: ID!
            domains: [Domain!]!
          }
          type Query {
            networks(ids: [ID!]!): [Network!]!
          }
        `,
      resolvers: {
        Domain: {
          __resolveType() {
            return 'Domain1'
          },
        },
        Query: {
          networks: (_root, { ids }) =>
            ids.map((id: any) => ({ id, domains: [{ id: Number(id) + 3, name: `network${id}.com` }] })),
        },
      },
    });

    const postsSchema = makeExecutableSchema({
      typeDefs: `
          type Post {
            id: ID!
            networkId: ID!
          }
          type Query {
            posts(ids: [ID!]!): [Post]!
          }
        `,
      resolvers: {
        Query: {
          posts: (_root, { ids }) =>
            ids.map((id: any) => ({
              id,
              networkId: Number(id) + 2,
            })),
        },
      },
    });

    const gatewaySchema = stitchSchemas({
      subschemas: [networkSchema, postsSchema],
      typeDefs: `
        extend type Post {
          network: Network!
        }
      `,
      resolvers: {
        Post: {
          network: {
            selectionSet: '{ networkId }',
            resolve(parent, _args, context, info) {
              return batchDelegateToSchema({
                key: parent.networkId,
                argsFromKeys: (ids) => ({ ids }),
                context,
                fieldName: 'networks',
                info,
                operation: 'query',
                schema: networkSchema,
              })
            },
          },
        },
      },
    });

    const expectedData = [
      {
        network: { id: '57', domains: [{ id: '60', name: 'network57.com' }] },
      },
    ];

    it('should resolve with no fragments', async () => {
      const { data } = await graphql(
        gatewaySchema,
        `
          query {
            posts(ids: [55]) {
              network {
                id
                domains {
                  id
                  name
                }
              }
            }
          }
        `,
      );

      assertSome(data)
      expect(data.posts).toEqual(expectedData);
    });

    it('should resolve with a fragment', async () => {
      const { data } = await graphql(
        gatewaySchema,
        `
          query {
            posts(ids: [55]) {
              ...F1
            }
          }

          fragment F1 on Post {
            network {
              id
              domains {
                id
                name
              }
            }
          }
        `,
      );
      assertSome(data)
      expect(data.posts).toEqual(expectedData);
    });

    it('should resolve with deep fragment', async () => {
      const { data } = await graphql(
        gatewaySchema,
        `
          query {
            posts(ids: [55]) {
              network {
                ...F1
              }
            }
          }

          fragment F1 on Network {
            id
            domains {
              id
              name
            }
          }
        `,
      );
      assertSome(data)
      expect(data.posts).toEqual(expectedData);
    });

    it('should resolve with nested fragments', async () => {
      const { data } = await graphql(
        gatewaySchema,
        `
          query {
            posts(ids: [55]) {
              ...F1
            }
          }

          fragment F1 on Post {
            network {
              ...F2
            }
          }

          fragment F2 on Network {
            id
            domains {
              id
              name
            }
          }
        `,
      )
      assertSome(data)
      expect(data.posts).toEqual(expectedData);
    });
  });
});

