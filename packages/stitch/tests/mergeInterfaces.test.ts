import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '../src/stitchSchemas';
import { assertSome } from '@graphql-tools/utils';

describe('merged interfaces via concrete type', () => {
  const namedItemSchema = makeExecutableSchema({
    typeDefs: `
      interface Placement {
        id: ID!
        name: String!
      }
      type Item implements Placement {
        id: ID!
        name: String!
      }
      type Query {
        itemById(id: ID!): Item
      }
    `,
    resolvers: {
      Query: {
        itemById(_obj, args) {
          return { id: args.id, name: `Item ${args.id}` };
        }
      }
    }
  });

  const indexedItemSchema = makeExecutableSchema({
    typeDefs: `
      interface Placement {
        id: ID!
        index: Int!
      }
      type Item implements Placement {
        id: ID!
        index: Int!
      }
      type Query {
        placementById(id: ID!): Placement
      }
    `,
    resolvers: {
      Query: {
        placementById(_obj, args) {
          return { __typename: 'Item', id: args.id, index: Number(args.id) };
        }
      }
    }
  });

  const stitchedSchema = stitchSchemas({
    subschemas: [
      {
        schema: namedItemSchema,
        merge: {
          Item: {
            selectionSet: '{ id }',
            fieldName: 'itemById',
            args: ({ id }) => ({ id }),
          }
        }
      },
      { schema: indexedItemSchema },
    ],
  });


  test('works with selection set key', async () => {
    const result = await graphql(stitchedSchema, `
      query {
        placement: placementById(id: 23) {
          id
          index
          name
        }
      }
    `);

    assertSome(result.data)
    expect(result.data.placement).toEqual({ id: '23', index: 23, name: 'Item 23' });
  });

  test('works without selection set key', async () => {
    const result = await graphql(stitchedSchema, `
      query {
        placement: placementById(id: 23) {
          index
          name
        }
      }
    `);

    assertSome(result.data)
    expect(result.data.placement).toEqual({ index: 23, name: 'Item 23' });
  });
});

describe('merged interfaces via abstract type', () => {
  const namedPlacementSchema = makeExecutableSchema({
    typeDefs: `
      interface Placement {
        id: ID!
        name: String!
      }
      type Item implements Placement {
        id: ID!
        name: String!
      }
      type Query {
        namedPlacementById(id: ID!): Placement
      }
    `,
    resolvers: {
      Query: {
        namedPlacementById(_obj, args) {
          return { __typename: 'Item', id: args.id, name: `Item ${args.id}` };
        }
      }
    }
  });

  const indexedItemSchema = makeExecutableSchema({
    typeDefs: `
      interface Placement {
        id: ID!
        index: Int!
      }
      type Item implements Placement {
        id: ID!
        index: Int!
      }
      type Query {
        placementById(id: ID!): Placement
      }
    `,
    resolvers: {
      Query: {
        placementById(_obj, args) {
          return { __typename: 'Item', id: args.id, index: Number(args.id) };
        }
      }
    }
  });

  const stitchedSchema = stitchSchemas({
    subschemas: [
      {
        schema: namedPlacementSchema,
        merge: {
          Item: {
            selectionSet: '{ id }',
            fieldName: 'namedPlacementById',
            args: ({ id }) => ({ id }),
          }
        }
      },
      { schema: indexedItemSchema },
    ],
  });


  test('works with selection set key', async () => {
    const result = await graphql(stitchedSchema, `
      query {
        placement: placementById(id: 23) {
          id
          index
          name
        }
      }
    `);


    assertSome(result.data)
    expect(result.data.placement).toEqual({ id: '23', index: 23, name: 'Item 23' });
  });

  test('works without selection set key', async () => {
    const result = await graphql(stitchedSchema, `
      query {
        placement: placementById(id: 23) {
          index
          name
        }
      }
    `);
    assertSome(result.data)
    expect(result.data.placement).toEqual({ index: 23, name: 'Item 23' });
  });
});
