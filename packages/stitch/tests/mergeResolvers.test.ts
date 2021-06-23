import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas, createMergedTypeResolver } from '@graphql-tools/stitch';
import { MergedTypeResolver, MergedTypeResolverOptions } from '@graphql-tools/delegate';
import { graphql } from 'graphql';
import { assertSome } from '@graphql-tools/utils';

describe('Merge resolvers', () => {
  const firstSchema = makeExecutableSchema({
    typeDefs: `
      type Widget {
        id: ID!
      }
      type Sprocket {
        id: ID!
      }
      type Query {
        widget(id: ID!): Widget
        sprocket(id: ID!): Sprocket
      }
    `,
    resolvers: {
      Query: {
        widget: (_root, { id }) => ({ id }),
        sprocket: (_root, { id }) => ({ id }),
      }
    }
  });

  const secondSchema = makeExecutableSchema({
    typeDefs: `
      type Widget {
        id: ID!
        source: String
      }
      type Sprocket {
        id: ID!
        source: String
      }
      type Query {
        _widgets(ids: [ID!]!): [Widget]!
        _sprocket(id: ID!): Sprocket
      }
    `,
    resolvers: {
      Query: {
        _widgets: (_root, { ids }) => ids.map((id: any) => ({ id, source: 'service' })),
        _sprocket: (_root, { id }) => ({ id, source: 'service' }),
      }
    }
  });

  it('works with custom resolvers', async () => {
    const gatewaySchema = stitchSchemas({
      subschemas: [
        {
          schema: firstSchema,
        },
        {
          schema: secondSchema,
          merge: {
            Widget: {
              selectionSet: '{ id }',
              fieldName: '_widgets',
              key: ({ id }) => id,
              argsFromKeys: (ids) => ({ ids }),
              resolve: (originalResult) => ({ ...originalResult, source: 'resolve' }),
            },
            Sprocket: {
              selectionSet: '{ id }',
              fieldName: '_sprocket',
              args: ({ id }) => ({ id }),
              resolve: (originalResult) => ({ ...originalResult, source: 'resolve' }),
            },
          },
        },
      ]
    });

    const { data } = await graphql(gatewaySchema, `
      query {
        widget(id: 1) { id source }
        sprocket(id: 1) { id source }
      }
    `);

    expect(data).toEqual({
      widget: { id: '1', source: 'resolve' },
      sprocket: { id: '1', source: 'resolve' },
    });
  });

  it('works with wrapped resolvers', async () => {
    function wrapResolve(mergedTypeResolverOptions: MergedTypeResolverOptions): MergedTypeResolver {
      const defaultResolve = createMergedTypeResolver(mergedTypeResolverOptions);
      assertSome(defaultResolve)
      return async (obj, ctx, inf, sch, sel, key) => {
        const result = await defaultResolve(obj, ctx, inf, sch, sel, key);
        result.source += '->resolve';
        return result;
      };
    }

    const gatewaySchema = stitchSchemas({
      subschemas: [
        {
          schema: firstSchema,
        },
        {
          schema: secondSchema,
          merge: {
            Widget: {
              selectionSet: '{ id }',
              key: ({ id }) => id,
              resolve: wrapResolve({
                fieldName: '_widgets',
                argsFromKeys: (ids) => ({ ids }),
              }),
            },
            Sprocket: {
              selectionSet: '{ id }',
              resolve: wrapResolve({
                fieldName: '_sprocket',
                args: ({ id }) => ({ id }),
              }),
            },
          },
        },
      ]
    });

    const { data } = await graphql(gatewaySchema, `
      query {
        widget(id: 1) { id source }
        sprocket(id: 1) { id source }
      }
    `);

    expect(data).toEqual({
      widget: { id: '1', source: 'service->resolve' },
      sprocket: { id: '1', source: 'service->resolve' },
    });
  });

});
