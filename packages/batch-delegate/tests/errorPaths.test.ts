import { graphql, GraphQLError } from 'graphql';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { delegateToSchema } from '@graphql-tools/delegate';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { stitchSchemas } from '@graphql-tools/stitch';

class NotFoundError extends GraphQLError {
  constructor(id: unknown) {
    super('Not Found', undefined, undefined, undefined, undefined, undefined, { id });
  }
}

describe('preserves error path indices', () => {
  const getProperty = jest.fn((id: unknown) => {
    return new NotFoundError(id);
  });

  beforeEach(() => {
    getProperty.mockClear();
  });

  const subschema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Property {
        id: ID!
      }

      type Object {
        id: ID!
        propertyId: ID!
      }

      type Query {
        objects: [Object!]!
        propertyById(id: ID!): Property
        propertiesByIds(ids: [ID!]!): [Property]!
      }
    `,
    resolvers: {
      Query: {
        objects: () => {
          return [
            { id: '1', propertyId: '1' },
            { id: '2', propertyId: '1' },
          ];
        },
        propertyById: (_, args) => getProperty(args.id),
        propertiesByIds: (_, args) => args.ids.map(getProperty),
      },
    },
  });

  const subschemas = [subschema];
  const typeDefs = /* GraphQL */ `
    extend type Object {
      property: Property
    }
  `;

  const query = /* GraphQL */ `
    query {
      objects {
        id
        property {
          id
        }
      }
    }
  `;

  const expected = {
    errors: [
      {
        message: 'Not Found',
        extensions: { id: '1' },
        path: ['objects', 0, 'property'],
      },
      {
        message: 'Not Found',
        extensions: { id: '1' },
        path: ['objects', 1, 'property'],
      },
    ],
    data: {
      objects: [
        {
          id: '1',
          property: null as null,
        },
        {
          id: '2',
          property: null as null,
        },
      ],
    },
  };

  test('using delegateToSchema', async () => {
    const schema = stitchSchemas({
      subschemas,
      typeDefs,
      resolvers: {
        Object: {
          property: {
            selectionSet: '{ propertyId }',
            resolve: (source, _, context, info) => {
              return delegateToSchema({
                schema: subschema,
                fieldName: 'propertyById',
                args: { id: source.propertyId },
                context,
                info,
              });
            },
          },
        },
      },
    });

    const result = await graphql(schema, query);

    expect(getProperty).toBeCalledTimes(2);
    expect(result).toMatchObject(expected);
  });

  test('using batchDelegateToSchema', async () => {
    const schema = stitchSchemas({
      subschemas,
      typeDefs,
      resolvers: {
        Object: {
          property: {
            selectionSet: '{ propertyId }',
            resolve: (source, _, context, info) => {
              return batchDelegateToSchema({
                schema: subschema,
                fieldName: 'propertiesByIds',
                key: source.propertyId,
                context,
                info,
              });
            },
          },
        },
      },
    });

    const result = await graphql(schema, query);

    expect(getProperty).toBeCalledTimes(1);
    expect(result).toMatchObject(expected);
  });
});
