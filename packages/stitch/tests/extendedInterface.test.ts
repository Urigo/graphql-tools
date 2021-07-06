import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '../src/stitchSchemas';
import { assertSome } from '@graphql-tools/utils';

describe('extended interfaces', () => {
  test('expands extended interface types for subservices', async () => {
    const itemsSchema = makeExecutableSchema({
      typeDefs: `
        interface Slot {
          id: ID!
        }
        type Item implements Slot {
          id: ID!
          name: String!
        }
        type Query {
          slot: Slot
        }
      `,
      resolvers: {
        Query: {
          slot() {
            return { __typename: 'Item', id: '23', name: 'The Item' };
          }
        }
      }
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [
        { schema: itemsSchema },
      ],
      typeDefs: `
        extend interface Slot {
          name: String!
        }
      `,
    });

    const { data } = await graphql(stitchedSchema, `
      query {
        slot {
          id
          name
        }
      }
    `);
    assertSome(data)
    expect(data['slot']).toEqual({ id: '23', name: 'The Item' });
  });

  test('merges types behind gateway interface extension', async () => {
    const itemsSchema = makeExecutableSchema({
      typeDefs: `
        type Item {
          id: ID!
          name: String!
        }
        type Query {
          itemById(id: ID!): Item
        }
      `,
      resolvers: {
        Query: {
          itemById(_obj, args, _context, _info) {
            return { id: args.id, name: `Item ${args.id}` };
          }
        }
      }
    });

    const placementSchema = makeExecutableSchema({
      typeDefs: `
        interface Placement {
          id: ID!
        }
        type Item implements Placement {
          id: ID!
        }
        type Query {
          placementById(id: ID!): Placement
        }
      `,
      resolvers: {
        Query: {
          placementById(_obj, args, _context, _info) {
            return { __typename: 'Item', id: args.id };
          }
        }
      }
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [
        {
          schema: itemsSchema,
          merge: {
            Item: {
              selectionSet: '{ id }',
              fieldName: 'itemById',
              args: ({ id }) => ({ id }),
            }
          }
        },
        { schema: placementSchema },
      ],
      typeDefs: `
        extend interface Placement {
          name: String!
        }
      `,
    });

    const result = await graphql(stitchedSchema, `
      query {
        placement: placementById(id: 23) {
          id
          name
        }
      }
    `);
    assertSome(result.data)
    expect(result.data['placement']).toEqual({ id: '23', name: 'Item 23' });
  });
});
