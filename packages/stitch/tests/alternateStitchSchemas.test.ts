import {
  graphql,
  GraphQLSchema,
  subscribe,
  parse,
  GraphQLScalarType,
  FieldNode,
  printSchema,
  graphqlSync,
  assertValidSchema,
  GraphQLFieldConfig,
  isSpecifiedScalarType,
  GraphQLNamedType,
  Kind,
} from 'graphql';

import {
  wrapSchema,
  RenameTypes,
  RenameRootFields,
  RenameObjectFields,
  TransformObjectFields,
  WrapType,
  WrapFields,
  HoistField,
  FilterRootFields,
  FilterObjectFields,
  RenameInterfaceFields,
  TransformRootFields,
  PruneSchema,
} from '@graphql-tools/wrap';

import { delegateToSchema, SubschemaConfig } from '@graphql-tools/delegate';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { filterSchema, ExecutionResult, assertSome } from '@graphql-tools/utils';

import { stitchSchemas } from '../src/stitchSchemas';

import {
  bookingSchema,
  propertySchema,
  remoteBookingSchema,
  subscriptionSchema,
  subscriptionPubSub,
  subscriptionPubSubTrigger,
} from './fixtures/schemas';

const linkSchema = `
  """
  A new type linking the Property type.
  """
  type LinkType {
    test: String
    """
    The property.
    """
    property: Properties_Property
  }

  interface Node {
    id: ID!
  }

  extend type Bookings_Booking implements Node {
    """
    The property of the booking.
    """
    property: Properties_Property
  }

  extend type Properties_Property implements Node {
    """
    A list of bookings.
    """
    bookings(
      """
      The maximum number of bookings to retrieve.
      """
      limit: Int
    ): [Bookings_Booking]
  }

  extend type Query {
    linkTest: LinkType
    node(id: ID!): Node
    nodes: [Node]
  }

  extend type Bookings_Customer implements Node
`;

describe('merge schemas through transforms', () => {
  let bookingSubschemaConfig: SubschemaConfig;
  let stitchedSchema: GraphQLSchema;

  beforeAll(async () => {
    bookingSubschemaConfig = await remoteBookingSchema;

    // namespace and strip schemas
    const propertySchemaTransforms = [
      new FilterRootFields(
        (operation: string, rootField: string) =>
          `${operation}.${rootField}` === 'Query.properties',
      ),
      new RenameTypes((name: string) => `Properties_${name}`),
      new RenameRootFields(
        (_operation: string, name: string) => `Properties_${name}`,
      ),
      new PruneSchema(),
    ];
    const bookingSchemaTransforms = [
      new FilterRootFields(
        (operation: string, rootField: string) =>
          `${operation}.${rootField}` === 'Query.bookings',
      ),
      new RenameTypes((name: string) => `Bookings_${name}`),
      new RenameRootFields(
        (_operation: string, name: string) => `Bookings_${name}`,
      ),
      new PruneSchema(),
    ];
    const subscriptionSchemaTransforms = [
      new FilterRootFields(
        (operation: string, rootField: string) =>
          // must include a Query type otherwise graphql will error
          `${operation}.${rootField}` === 'Query.notifications' ||
          `${operation}.${rootField}` === 'Subscription.notifications',
      ),
      new RenameTypes((name: string) => `Subscriptions_${name}`),
      new RenameRootFields(
        (_operation: string, name: string) => `Subscriptions_${name}`,
      ),
      new PruneSchema(),
    ];

    const propertySubschema = {
      schema: propertySchema,
      transforms: propertySchemaTransforms,
      batch: true,
    };
    const bookingSubschema = {
      ...bookingSubschemaConfig,
      transforms: bookingSchemaTransforms,
      batch: true,
    };
    const subscriptionSubschema = {
      schema: subscriptionSchema,
      transforms: subscriptionSchemaTransforms,
      batch: true,
    };

    stitchedSchema = stitchSchemas({
      subschemas: [propertySubschema, bookingSubschema, subscriptionSubschema],
      typeDefs: linkSchema,
      resolvers: {
        Query: {
          // delegating directly, no subschemas or stitchingInfo
          node: (_parent, args, context, info) => {
            if (args.id.startsWith('p')) {
              return delegateToSchema({
                schema: propertySubschema,
                operation: 'query',
                fieldName: 'propertyById',
                args,
                context,
                info,
                transforms: [],
              });
            } else if (args.id.startsWith('b')) {
              return delegateToSchema({
                schema: bookingSubschema,
                operation: 'query',
                fieldName: 'bookingById',
                args,
                context,
                info,
                transforms: [],
              });
            } else if (args.id.startsWith('c')) {
              return delegateToSchema({
                schema: bookingSubschema,
                operation: 'query',
                fieldName: 'customerById',
                args,
                context,
                info,
                transforms: [],
              });
            }
            throw new Error('invalid id');
          },
        },
        Properties_Property: {
          bookings: {
            selectionSet: '{ id }',
            resolve: (parent, args, context, info) =>
              delegateToSchema({
                schema: bookingSubschema,
                operation: 'query',
                fieldName: 'bookingsByPropertyId',
                args: {
                  propertyId: parent.id,
                  limit: args.limit ? args.limit : null,
                },
                context,
                info,
              }),
          },
        },
        Bookings_Booking: {
          property: {
            selectionSet: () => ({
              kind: Kind.SELECTION_SET,
              selections: [{
                kind: Kind.FIELD,
                name: {
                  kind: Kind.NAME,
                  value: 'propertyId',
                }
              }]
            }),
            resolve: (parent, _args, context, info) =>
              delegateToSchema({
                schema: propertySubschema,
                operation: 'query',
                fieldName: 'propertyById',
                args: {
                  id: parent.propertyId,
                },
                context,
                info,
              }),
          },
        },
      },
    });
  });

  // FIXME fragment replacements
  test('node should work', async () => {
    const result = await graphql(
      stitchedSchema,
      `
        query($pid: ID!, $bid: ID!) {
          property: node(id: $pid) {
            __typename
            ... on Properties_Property {
              name
              bookings {
                startTime
                endTime
              }
            }
          }
          booking: node(id: $bid) {
            __typename
            ... on Bookings_Booking {
              startTime
              endTime
              property {
                id
                name
              }
            }
          }
        }
      `,
      {},
      {},
      {
        pid: 'p1',
        bid: 'b1',
      },
    );

    expect(result).toEqual({
      data: {
        booking: {
          __typename: 'Bookings_Booking',
          endTime: '2016-06-03',
          property: {
            id: 'p1',
            name: 'Super great hotel',
          },
          startTime: '2016-05-04',
        },
        property: {
          __typename: 'Properties_Property',
          bookings: [
            {
              endTime: '2016-06-03',
              startTime: '2016-05-04',
            },
            {
              endTime: '2016-07-03',
              startTime: '2016-06-04',
            },
            {
              endTime: '2016-09-03',
              startTime: '2016-08-04',
            },
          ],
          name: 'Super great hotel',
        },
      },
    });
  });

  test('local subscriptions should work even if root fields are renamed', async () => {
    const originalNotification = {
      notifications: {
        text: 'Hello world',
      },
    };

    const transformedNotification = {
      // eslint-disable-next-line camelcase
      Subscriptions_notifications: originalNotification.notifications,
    };

    const subscription = parse(`
      subscription Subscription {
        Subscriptions_notifications {
          text
        }
      }
    `);

    const sub = await subscribe(stitchedSchema, subscription) as AsyncIterableIterator<ExecutionResult>;

    const payload = sub.next();

    await subscriptionPubSub.publish(
      subscriptionPubSubTrigger,
      originalNotification,
    );

    expect(await payload).toEqual({ done: false, value: { data: transformedNotification } } );
  });
});

describe('transform object fields', () => {
  test('should work to add a resolver', async () => {
    const transformedPropertySchema = wrapSchema({
      schema: propertySchema,
      transforms: [
        new TransformObjectFields(
          (
            typeName: string,
            fieldName: string,
            fieldConfig: GraphQLFieldConfig<any, any>,
          ) => {
            if (typeName !== 'Property' || fieldName !== 'name') {
              return undefined;
            }
            return {
              ...fieldConfig,
              description: fieldConfig.deprecationReason,
              resolve: () => 'test',
            };
          },
          (typeName: string, fieldName: string, fieldNode: FieldNode) => {
            if (typeName !== 'Property' || fieldName !== 'name') {
              return fieldNode;
            }
            const newFieldNode = {
              ...fieldNode,
              name: {
                ...fieldNode.name,
                value: 'id',
              },
            };
            return newFieldNode;
          },
        ),
      ],
    });

    const result = await graphql(
      transformedPropertySchema,
      `
        query($pid: ID!) {
          propertyById(id: $pid) {
            id
            name
            location {
              name
            }
          }
        }
      `,
      {},
      {},
      {
        pid: 'p1',
      },
    );

    expect(result).toEqual({
      data: {
        propertyById: {
          id: 'p1',
          name: 'test',
          location: {
            name: 'Helsinki',
          },
        },
      },
    });
  });
});

describe('optional arguments', () => {
  const schema = makeExecutableSchema({
    typeDefs: `
      enum Arg {
        possibleArg
      }
      type Query {
        test(arg: Arg): Boolean
      }
    `,
    resolvers: {
      Query: {
        test: (_root, args, _context) => args.arg === undefined,
      },
    },
  });

  const stitchedSchema = stitchSchemas({
    subschemas: [schema],
  });

  it('work with schema stitching', async () => {
    const query = `
      {
        test
      }
    `;

    const originalResult = await graphql(schema, query);
    assertSome(originalResult.data)
    expect(originalResult.data['test']).toEqual(true);

    const stitchedResult = await graphql(stitchedSchema, query);
    assertSome(stitchedResult.data)
    expect(stitchedResult.data['test']).toEqual(true);
  });

  it('work with schema stitching when using variables', async () => {
    const query = `
      query test($arg: Arg) {
        test(arg: $arg)
      }
    `;

    const originalResult = await graphql(schema, query);
    assertSome(originalResult.data)
    expect(originalResult.data['test']).toEqual(true);

    const stitchedResult = await graphql(stitchedSchema, query);
    assertSome(stitchedResult.data)
    expect(stitchedResult.data['test']).toEqual(true);
  });

  // See https://github.com/graphql/graphql-js/issues/2533
  it('may not work as expected when explicitly passing in an undefined value', async () => {
    const query = `
      query test($arg: Arg) {
        test(arg: $arg)
      }
    `;

    const originalResult = await graphql(
      schema,
      query,
      {},
      {},
      { arg: undefined },
    );
    assertSome(originalResult.data)
    expect(originalResult.data['test']).toEqual(false);

    const stitchedResult = await graphql(
      stitchedSchema,
      query,
      {},
      {},
      { arg: undefined },
    );
    assertSome(stitchedResult.data)
    expect(stitchedResult.data['test']).toEqual(false);
  });
});

describe('default values', () => {
  test('should work to add a default value even when renaming root fields', async () => {
    const transformedPropertySchema = wrapSchema({
      schema: propertySchema,
      transforms: [
        new TransformRootFields(
          (
            typeName,
            fieldName,
            fieldConfig,
          ) => {
            if (typeName === 'Query' && fieldName === 'jsonTest') {
              assertSome(fieldConfig.args)
              return [
                'renamedJsonTest',
                {
                  ...fieldConfig,
                  description: fieldConfig.deprecationReason,
                  args: {
                    ...fieldConfig.args,
                    input: {
                      ...fieldConfig.args['input'],
                      defaultValue: { test: 'test' }
                    }
                  }
                }
              ];
            }
          },
        ),
      ],
    });

    const result = await graphql(
      transformedPropertySchema,
      `
        query {
          renamedJsonTest
        }
      `,
    );

    expect(result).toEqual({
      data: {
        renamedJsonTest: {
          test: 'test',
        },
      },
    });
  });
});

describe('rename fields that implement interface fields', () => {
  test('should work', () => {
    const originalItem = {
      id: '123',
      camel: "I'm a camel!",
    };

    const originalSchema = makeExecutableSchema({
      typeDefs: `
        interface Node {
          id: ID!
        }
        interface Item {
          node: Node
        }
        type Camel implements Node {
          id: ID!
          camel: String!
        }
        type Query implements Item {
          node: Node
        }
      `,
      resolvers: {
        Query: {
          node: () => originalItem,
        },
        Node: {
          __resolveType: () => 'Camel',
        },
      },
    });

    const wrappedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RenameRootFields((_operation, fieldName) => {
          if (fieldName === 'node') {
            return '_node';
          }
          return fieldName;
        }),
        new RenameInterfaceFields((typeName, fieldName) => {
          if (typeName === 'Item' && fieldName === 'node') {
            return '_node';
          }
          return fieldName;
        }),
      ],
    });

    const originalQuery = `
      query {
        node {
          id
          ... on Camel {
            camel
          }
        }
      }
    `;

    const newQuery = `
      query {
        _node {
          id
          ... on Camel {
            camel
          }
        }
      }
    `;

    const originalResult = graphqlSync(originalSchema, originalQuery);
    expect(originalResult).toEqual({ data: { node: originalItem } });

    const newResult = graphqlSync(wrappedSchema, newQuery);
    expect(newResult).toEqual({ data: { _node: originalItem } });
  });
});

describe('transform object fields', () => {
  let schema: GraphQLSchema;

  beforeAll(() => {
    const ITEM = {
      id: '123',
      // eslint-disable-next-line camelcase
      camel_case: "I'm a camel!",
    };

    const itemSchema = makeExecutableSchema({
      typeDefs: `
        type Item {
          id: ID!
          camel_case: String
        }
        type ItemConnection {
          edges: [ItemEdge!]!
        }
        type ItemEdge {
          node: Item!
        }
        type Query {
          item: Item
          allItems: ItemConnection!
        }
      `,
      resolvers: {
        Query: {
          item: () => ITEM,
          allItems: () => ({
            edges: [
              {
                node: ITEM,
              },
            ],
          }),
        },
      },
    });

    schema = wrapSchema({
      schema: itemSchema,
      transforms: [
        new FilterObjectFields((_typeName, fieldName) => {
          if (fieldName === 'id') {
            return false;
          }
          return true;
        }),
        new RenameRootFields((_operation, fieldName) => {
          if (fieldName === 'allItems') {
            return 'items';
          }
          return fieldName;
        }),
        new RenameObjectFields((_typeName, fieldName) => {
          if (fieldName === 'camel_case') {
            return 'camelCase';
          }
          return fieldName;
        }),
        new RenameObjectFields((_typeName, fieldName) => {
          if (fieldName === 'camelCase') {
            return 'prefixCamelCase';
          }
          return fieldName;
        }),
      ],
    });
  });

  test('renaming should work', async () => {
    const result = await graphql(
      schema,
      `
        query {
          item {
            prefixCamelCase
          }
          items {
            edges {
              node {
                prefixCamelCase
              }
            }
          }
        }
      `,
    );

    const TRANSFORMED_ITEM = {
      prefixCamelCase: "I'm a camel!",
    };

    expect(result).toEqual({
      data: {
        item: TRANSFORMED_ITEM,
        items: {
          edges: [
            {
              node: TRANSFORMED_ITEM,
            },
          ],
        },
      },
    });
  });

  test('filtering should work', async () => {
    const result = await graphql(
      schema,
      `
        query {
          items {
            edges {
              node {
                id
              }
            }
          }
        }
      `,
    );

    const expectedResult: any = {
      errors: [
        {
          locations: [
            {
              column: 17,
              line: 6,
            },
          ],
          message: 'Cannot query field "id" on type "Item".',
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });
});

describe('filter and rename object fields', () => {
  let transformedPropertySchema: GraphQLSchema;

  beforeAll(() => {
    transformedPropertySchema = filterSchema({
      schema: wrapSchema({
        schema: propertySchema,
        transforms: [
          new RenameTypes((name: string) => `New_${name}`),
          new RenameObjectFields((typeName: string, fieldName: string) =>
            typeName === 'New_Property' ? `new_${fieldName}` : fieldName,
          ),
        ],
      }),
      rootFieldFilter: (operation: string, fieldName: string) =>
        `${operation}.${fieldName}` === 'Query.propertyById',
      objectFieldFilter: (typeName: string, fieldName: string) =>
        typeName === 'New_Property' || fieldName === 'name',
      typeFilter: (typeName: string, type) =>
        typeName === 'New_Property' ||
        typeName === 'New_Location' ||
        isSpecifiedScalarType(type as GraphQLNamedType),
    });
  });

  test('should filter', () => {
    const printedSchema = printSchema(transformedPropertySchema);
    expect(printedSchema).toContain(
      `
type New_Property {
  new_id: ID!
  new_name: String!
  new_location: New_Location
  new_error: String
}
    `.trim(),
    );
    expect(printedSchema).toContain(
      `
type New_Location {
  name: String!
}
    `.trim(),
    );
    expect(printedSchema).toContain(
      `
type Query {
  propertyById(id: ID!): New_Property
}
    `.trim(),
    );
  });

  test('should work', async () => {
    const result = await graphql(
      transformedPropertySchema,
      `
        query($pid: ID!) {
          propertyById(id: $pid) {
            new_id
            new_name
            new_location {
              name
            }
            new_error
          }
        }
      `,
      {},
      {},
      {
        pid: 'p1',
      },
    );

    const expectedResult: any = {
      data: {
        propertyById: {
          // eslint-disable-next-line camelcase
          new_id: 'p1',
          // eslint-disable-next-line camelcase
          new_name: 'Super great hotel',
          // eslint-disable-next-line camelcase
          new_location: {
            name: 'Helsinki',
          },
          // eslint-disable-next-line camelcase
          new_error: null,
        },
      },
      errors: [
        {
          locations: [
            {
              column: 13,
              line: 9,
            },
          ],
          message: 'Property.error error',
          path: ['propertyById', 'new_error'],
        },
      ],
    };

    expectedResult.errors[0].extensions = { code: 'SOME_CUSTOM_CODE' };

    expect(result).toEqual(expectedResult);
  });
});

describe('rename nested object fields with interfaces', () => {
  test('should work', () => {
    const originalNode = {
      aList: [
        {
          anInnerObject: {
            _linkType: 'linkedItem',
            aString: 'Hello, world',
          },
        },
      ],
    };

    const transformedNode = {
      ALIST: [
        {
          ANINNEROBJECT: {
            _linkType: 'linkedItem',
            ASTRING: 'Hello, world',
          },
        },
      ],
    };

    const originalSchema = makeExecutableSchema({
      typeDefs: `
        interface _Linkable {
          _linkType: String!
        }
        type linkedItem implements _Linkable {
          _linkType: String!
          aString: String!
        }
        type aLink {
          anInnerObject: _Linkable
        }
        type aObject {
          aList: [aLink!]
        }
        type Query {
          node: aObject
        }
      `,
      resolvers: {
        _Linkable: {
          __resolveType: (linkable: { _linkType: string }) =>
            linkable._linkType,
        },
        Query: {
          node: () => originalNode,
        },
      },
    });

    const transformedSchema = wrapSchema({
      schema: originalSchema,
      transforms: [
        new RenameObjectFields((typeName, fieldName) => {
          if (typeName === 'Query') {
            return fieldName;
          }

          // Remote uses leading underscores for special fields. Leave them alone.
          if (fieldName[0] === '_') {
            return fieldName;
          }

          return fieldName.toUpperCase();
        }),
      ],
    });

    const originalQuery = `
      query {
        node {
          aList {
            anInnerObject {
              _linkType
              ... on linkedItem {
                aString
              }
            }
          }
        }
      }
    `;

    const transformedQuery = `
      query {
        node {
          ALIST {
            ANINNEROBJECT {
              _linkType
              ... on linkedItem {
                ASTRING
              }
            }
          }
        }
      }
    `;

    const originalResult = graphqlSync(originalSchema, originalQuery);
    const transformedResult = graphqlSync(transformedSchema, transformedQuery);

    expect(originalResult).toEqual({ data: { node: originalNode } });
    expect(transformedResult).toEqual({
      data: { node: transformedNode },
    });
  });
});

describe('WrapType', () => {
  test('Query transform should work', async () => {
    const transformedBookingSchema = wrapSchema({
      schema: bookingSchema,
      transforms: [
        new WrapType('Query', 'Namespace_Query', 'namespace'),
      ],
    });
    const result = await graphql(
      transformedBookingSchema,
      `
        query($bid: ID!) {
          namespace {
            bookingById(id: $bid) {
              id
              startTime
              endTime
              error
            }
          }
        }
      `,
      undefined,
      undefined,
      {
        bid: 'b1',
      },
    );

    const expectedResult: any = {
      data: {
        namespace: {
          bookingById: {
            id: 'b1',
            startTime: '2016-05-04',
            endTime: '2016-06-03',
            error: null,
          },
        },
      },
      errors: [
        {
          locations: [
            {
              column: 15,
              line: 8,
            },
          ],
          message: 'Booking.error error',
          path: ['namespace', 'bookingById', 'error'],
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });

  test('Mutation transform should work', async () => {
    const transformedBookingSchema = wrapSchema({
      schema: bookingSchema,
      transforms: [
        new WrapType('Mutation', 'Namespace_Mutation', 'namespace'),
      ],
    });
    const result = await graphql(
      transformedBookingSchema,
      `
        mutation($bi: BookingInput!) {
          namespace {
            addBooking(input: $bi) {
              id
              propertyId
              startTime,
              endTime,
              error
            }
          }
        }
      `,
      undefined,
      undefined,
      {
        bi: {
          propertyId: "p1",
          customerId: "c1",
          startTime: "2020-07-02",
          endTime: "2020-07-03",
        },
      },
    );

    const expectedResult: any = {
      data: {
        namespace: {
          addBooking: {
            id: "newId",
            propertyId: "p1",
            startTime: "2020-07-02",
            endTime: "2020-07-03",
            error: null,
          },
        },
      },
      errors: [
        {
          locations: [
            {
              column: 15,
              line: 9,
            },
          ],
          message: 'Booking.error error',
          path: ['namespace', 'addBooking', 'error'],
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });

  test('namespacing different subschemas with overlapping root field names', async () => {
    const typeDefGen = (i: number) => `
      type Query {
        test: Test${i}Response
      }

      type Test${i}Response {
        aString: String!
      }
    `;

    const resolverGen = (i: number) => ({
      Query: {
        test: () => ({
          aString: `test${i}`,
        }),
      },
    });

    const subschemaGen = (i: number) => ({
      schema: makeExecutableSchema({
        typeDefs: typeDefGen(i),
        resolvers: resolverGen(i)
      }),
      transforms: [new WrapType(`Query`, `Test${i}_Query`, `test${i}`)]
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [subschemaGen(1), subschemaGen(2)]
    });

    const query = `{
      test1 {
        test {
          aString
        }
      }
      test2 {
        test {
          aString
        }
      }
    }`;

    const result = await graphql(stitchedSchema, query);

    const expectedResult = {
      data: {
        test1: {
          test: {
            aString: 'test1',
          },
        },
        test2: {
          test: {
            aString: 'test2',
          },
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });
});

describe('schema transformation with extraction of nested fields', () => {
  test('should work via HoistField transform', async () => {
    const transformedPropertySchema = wrapSchema({
      schema: propertySchema,
      transforms: [
        new HoistField('Property', ['location', 'name'], 'locationName'),
      ],
    });

    const result = await graphql(
      transformedPropertySchema,
      `
        query($pid: ID!) {
          propertyById(id: $pid) {
            test: locationName
          }
        }
      `,
      {},
      {},
      {
        pid: 'p1',
      },
    );

    expect(result).toEqual({
      data: {
        propertyById: {
          test: 'Helsinki',
        },
      },
    });
  });

});

describe('HoistField transform', () => {
  const schema = makeExecutableSchema({
    typeDefs: `
      type Query {
        query: Outer
      }
      type Outer {
        inner(innerArg: String): Inner
      }
      type Inner {
        test(testArg: String = "test"): String
      }
    `,
    resolvers: {
      Query: {
        query: () => ({ inner: {} }),
      },
      Outer: {
        inner: (_parent, args) => ({ innerArg: args.innerArg }),
      },
      Inner: {
        test: (parent, args) => parent.innerArg ?? args.testArg,
      },
    },
  })

  test('should work to hoist fields without using arguments', async () => {
    const wrappedSchema = wrapSchema({
      schema,
      transforms: [new HoistField('Outer', ['inner', 'test'], 'hoisted'), new PruneSchema({})],
    })

    const result = await graphql(wrappedSchema, '{ query { hoisted } }');

    const expectedResult = {
      data: {
        query: {
          hoisted: 'test',
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('should work to hoist fields with using arguments', async () => {
    const wrappedSchema = wrapSchema({
      schema,
      transforms: [new HoistField('Outer', ['inner', 'test'], 'hoisted'), new PruneSchema({})],
    })

    const result = await graphql(wrappedSchema, '{ query { hoisted(testArg: "custom") } }');

    const expectedResult = {
      data: {
        query: {
          hoisted: 'custom',
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('should work to hoist fields with using arguments from fields in path', async () => {
    const wrappedSchema = wrapSchema({
      schema,
      transforms: [
        new HoistField(
          'Outer',
          [
            { fieldName: 'inner', argFilter: () => true },
            'test'
          ],
          'hoisted'
        ),
        new PruneSchema({})
      ],
    })

    const result = await graphql(wrappedSchema, '{ query { hoisted(innerArg: "priority", testArg: "custom") } }');

    const expectedResult = {
      data: {
        query: {
          hoisted: 'priority',
        },
      },
    };

    expect(result).toEqual(expectedResult);
  });

  test('should work to hoist fields to new root fields', async () => {
    const wrappedSchema = wrapSchema({
      schema,
      transforms: [new HoistField('Query', ['query', 'inner', 'test'], 'hoisted'), new PruneSchema({})],
    })

    const result = await graphql(wrappedSchema, '{ hoisted }');

    const expectedResult = {
      data: {
        hoisted: 'test',
      },
    };

    expect(result).toEqual(expectedResult);
  });
});

describe('schema transformation with wrapping of object fields', () => {
  describe('WrapFields transform', () => {
    test('should work to wrap fields even with errors', async () => {
      const transformedPropertySchema = wrapSchema({
        schema: propertySchema,
        transforms: [
          new WrapFields(
            'Property',
            ['outerWrap'],
            ['OuterWrap'],
            ['id', 'name', 'error'],
          ),
        ],
      });

      const result = await graphql(
        transformedPropertySchema,
        `
          query($pid: ID!) {
            propertyById(id: $pid) {
              test1: outerWrap {
                ...W1
              }
              test2: outerWrap {
                ...W2
              }
            }
          }
          fragment W1 on OuterWrap {
            one: id
            two: error
          }
          fragment W2 on OuterWrap {
            one: name
          }
        `,
        {},
        {},
        {
          pid: 'p1',
        },
      );

      const expectedResult: any = {
        data: {
          propertyById: {
            test1: {
              one: 'p1',
              two: null,
            },
            test2: {
              one: 'Super great hotel',
            },
          },
        },
        errors: [
          {
            locations: [
              {
                column: 13,
                line: 14,
              },
            ],
            message: 'Property.error error',
            path: ['propertyById', 'test1', 'two'],
          },
        ],
      };

      expectedResult.errors[0].extensions = { code: 'SOME_CUSTOM_CODE' };

      expect(result).toEqual(expectedResult);
    });

    test('should work, even with multiple fields', async () => {
      const transformedPropertySchema = wrapSchema({
        schema: propertySchema,
        transforms: [
          new WrapFields(
            'Property',
            ['outerWrap', 'innerWrap'],
            ['OuterWrap', 'InnerWrap'],
            ['id', 'name', 'error'],
          ),
        ],
      });

      const result = await graphql(
        transformedPropertySchema,
        `
          query($pid: ID!) {
            propertyById(id: $pid) {
              test1: outerWrap {
                innerWrap {
                  ...W1
                }
              }
              test2: outerWrap {
                innerWrap {
                  ...W2
                }
              }
            }
          }
          fragment W1 on InnerWrap {
            one: id
            two: error
          }
          fragment W2 on InnerWrap {
            one: name
          }
        `,
        {},
        {},
        {
          pid: 'p1',
        },
      );

      const expectedResult: any = {
        data: {
          propertyById: {
            test1: {
              innerWrap: {
                one: 'p1',
                two: null,
              },
            },
            test2: {
              innerWrap: {
                one: 'Super great hotel',
              },
            },
          },
        },
        errors: [
          {
            locations: [
              {
                column: 13,
                line: 18,
              },
            ],
            message: 'Property.error error',
            path: ['propertyById', 'test1', 'innerWrap', 'two'],
          },
        ],
      };

      expectedResult.errors[0].extensions = { code: 'SOME_CUSTOM_CODE' };

      expect(result).toEqual(expectedResult);
    });

    test('should work with selectionSets', async () => {
      let subschema = makeExecutableSchema({
        typeDefs: `
          type Query {
            user: User
          }
          type User {
            id: ID
          }
        `,
      });

      subschema = addMocksToSchema({ schema: subschema });
      const stitchedSchema = stitchSchemas({
        subschemas: [{
          schema: subschema,
          transforms: [
            new WrapFields('Query', ['wrapped'], [`WrappedQuery`]),
          ],
        }],
        typeDefs: `
          extend type User {
            dummy: String
          }
        `,
        resolvers: {
          User: {
            dummy: {
              selectionSet: `{ id }`,
              resolve: (user: any) => user.id,
            },
          },
        },
      });

      const query = '{ wrapped { user { dummy } } }';
      const result = await graphql(stitchedSchema, query);
      assertSome(result.data)
      expect(result.data['wrapped'].user.dummy).not.toEqual(null);
    });
  });
});

describe('interface resolver inheritance', () => {
  const testSchemaWithInterfaceResolvers = `
    interface Node {
      id: ID!
    }
    type User implements Node {
      id: ID!
      name: String!
    }
    type Query {
      user: User!
    }
    schema {
      query: Query
    }
  `;
  const user = { _id: 1, name: 'Ada', type: 'User' };
  const resolvers = {
    Node: {
      __resolveType: ({ type }: { type: string }) => type,
      id: ({ _id }: { _id: number }) => `Node:${_id.toString()}`,
    },
    User: {
      name: ({ name }: { name: string }) => `User:${name}`,
    },
    Query: {
      user: () => user,
    },
  };

  test('copies resolvers from interface', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [
        // pull in an executable schema just so stitchSchemas doesn't complain
        // about not finding default types (e.g. ID)
        propertySchema,
      ],
      typeDefs: testSchemaWithInterfaceResolvers,
      resolvers,
      inheritResolversFromInterfaces: true,
    });
    const query = '{ user { id name } }';
    const response = await graphql(stitchedSchema, query);
    expect(response).toEqual({
      data: {
        user: {
          id: 'Node:1',
          name: 'User:Ada',
        },
      },
    });
  });

  test('does not copy resolvers from interface when flag is false', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [
        // pull in an executable schema just so mergeSchema doesn't complain
        // about not finding default types (e.g. ID)
        propertySchema,
      ],
      typeDefs: testSchemaWithInterfaceResolvers,
      resolvers,
      inheritResolversFromInterfaces: false,
    });
    const query = '{ user { id name } }';
    const response = await graphql(stitchedSchema, query);
    assertSome(response.errors)
    expect(response.errors.length).toBe(1);
    expect(response.errors[0].message).toBe(
      'Cannot return null for non-nullable field User.id.',
    );
    expect(response.errors[0].path).toEqual(['user', 'id']);
  });

  test('does not copy resolvers from interface when flag is not provided', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [
        // pull in an executable schema just so stitchSchemas doesn't complain
        // about not finding default types (e.g. ID)
        propertySchema,
      ],
      typeDefs: testSchemaWithInterfaceResolvers,
      resolvers,
    });
    const query = '{ user { id name } }';
    const response = await graphql(stitchedSchema, query);
    assertSome(response.errors)
    expect(response.errors.length).toBe(1);
    expect(response.errors[0].message).toBe(
      'Cannot return null for non-nullable field User.id.',
    );
    expect(response.errors[0].path).toEqual(['user', 'id']);
  });
});

describe('stitchSchemas', () => {
  test('can merge null root fields', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type Query {
          test: Test
        }
        type Test {
          field: String
        }
      `,
      resolvers: {
        Query: {
          test: () => null,
        },
      },
    });
    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ test { field } }';
    const response = await graphql(stitchedSchema, query);
    assertSome(response.data)
    expect(response.data['test']).toBe(null);
    expect(response.errors).toBeUndefined();
  });

  test('can merge default input types', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        input InputWithDefault {
          field: String = "test"
        }
        type Query {
          getInput(input: InputWithDefault!): String
        }
      `,
      resolvers: {
        Query: {
          getInput: (_root, args) => args.input.field,
        },
      },
    });
    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
    });

    const query = '{ getInput(input: {}) }';
    const response = await graphql(stitchedSchema, query);

    const printedSchema = printSchema(schema);
    expect(printedSchema).toContain(
      `
input InputWithDefault {
  field: String = "test"
}
    `.trim(),
    );
    expect(printedSchema).toContain(
      `
type Query {
  getInput(input: InputWithDefault!): String
}
    `.trim(),
    );
    expect(response.data?.['getInput']).toBe('test');
  });

  test('can override scalars with new internal values', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        scalar TestScalar
        type Query {
          getTestScalar: TestScalar
        }
      `,
      resolvers: {
        TestScalar: new GraphQLScalarType({
          name: 'TestScalar',
          description: undefined,
          serialize: (value) => (value as string).slice(1),
          parseValue: (value) => `_${value as string}`,
          parseLiteral: (ast: any) => `_${ast.value as string}`,
        }),
        Query: {
          getTestScalar: () => '_test',
        },
      },
    });
    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
      resolvers: {
        TestScalar: new GraphQLScalarType({
          name: 'TestScalar',
          description: undefined,
          serialize: (value) => (value as string).slice(2),
          parseValue: (value) => `__${value as string}`,
          parseLiteral: (ast: any) => `__${ast.value as string}`,
        }),
      },
    });

    const query = '{ getTestScalar }';
    const response = await graphql(stitchedSchema, query);

    expect(response.data?.['getTestScalar']).toBe('test');
  });

  test('can override scalars with new internal values when using default input types', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
          scalar TestScalar
          type Query {
            getTestScalar(input: TestScalar = "test"): TestScalar
          }
        `,
      resolvers: {
        TestScalar: new GraphQLScalarType({
          name: 'TestScalar',
          description: undefined,
          serialize: (value) => (value as string).slice(1),
          parseValue: (value) => `_${value as string}`,
          parseLiteral: (ast: any) => `_${ast.value as string}`,
        }),
        Query: {
          getTestScalar: () => '_test',
        },
      },
    });
    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
      resolvers: {
        TestScalar: new GraphQLScalarType({
          name: 'TestScalar',
          description: undefined,
          serialize: (value) => (value as string).slice(2),
          parseValue: (value) => `__${value as string}`,
          parseLiteral: (ast: any) => `__${ast.value as string}`,
        }),
      },
    });

    const query = '{ getTestScalar }';
    const response = await graphql(stitchedSchema, query);

    expect(response.data?.['getTestScalar']).toBe('test');
  });

  test('can use @include directives', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type WrappingType {
          subfield: String
        }
        type Query {
          get1: WrappingType
        }
      `,
      resolvers: {
        Query: {
          get1: () => ({ subfield: 'test' }),
        },
      },
    });
    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
      typeDefs: `
        type Query {
          get2: WrappingType
        }
      `,
      resolvers: {
        Query: {
          get2: (_root, _args, context, info) =>
            delegateToSchema({
              schema,
              operation: 'query',
              fieldName: 'get1',
              context,
              info,
            }),
        },
      },
    });

    const query = `
      {
        get2 @include(if: true) {
          subfield
        }
      }
    `;
    const response = await graphql(stitchedSchema, query);
    expect(response.data?.['get2'].subfield).toBe('test');
  });

  test('can use functions in subfields', async () => {
    const schema = makeExecutableSchema({
      typeDefs: `
        type WrappingObject {
          functionField: Int!
        }
        type Query {
          wrappingObject: WrappingObject
        }
      `,
    });

    const stitchedSchema = stitchSchemas({
      subschemas: [schema],
      resolvers: {
        Query: {
          wrappingObject: () => ({
            functionField: () => 8,
          }),
        },
      },
    });

    const query = '{ wrappingObject { functionField } }';
    const response = await graphql(stitchedSchema, query);
    expect(response.data?.['wrappingObject'].functionField).toBe(8);
  });
});

describe('onTypeConflict', () => {
  let schema1: GraphQLSchema;
  let schema2: GraphQLSchema;

  beforeEach(() => {
    const typeDefs1 = `
      type Query {
        test1: Test
      }

      type Test {
        fieldA: String
        fieldB: String
      }
    `;

    const typeDefs2 = `
      type Query {
        test2: Test
      }

      type Test {
        fieldA: String
        fieldC: String
      }
      `;

    schema1 = makeExecutableSchema({
      typeDefs: typeDefs1,
      resolvers: {
        Query: {
          test1: () => ({}),
        },
        Test: {
          fieldA: () => 'A',
          fieldB: () => 'B',
        },
      },
    });

    schema2 = makeExecutableSchema({
      typeDefs: typeDefs2,
      resolvers: {
        Query: {
          test2: () => ({}),
        },
        Test: {
          fieldA: () => 'A',
          fieldC: () => 'C',
        },
      },
    });
  });

  test('takes last type if mergeTypes is false', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [schema1, schema2],
      mergeTypes: false,
    });
    const result1 = await graphql(stitchedSchema, '{ test2 { fieldC } }');
    expect(result1.data?.['test2'].fieldC).toBe('C');
    const result2 = await graphql(stitchedSchema, '{ test2 { fieldB } }');
    expect(result2.data).toBeUndefined();
  });

  test('can use onTypeConflict to select last type', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [schema1, schema2],
      mergeTypes: false,
      onTypeConflict: (_left, right) => right,
    });
    const result1 = await graphql(stitchedSchema, '{ test2 { fieldC } }');
    expect(result1.data?.['test2'].fieldC).toBe('C');
    const result2 = await graphql(stitchedSchema, '{ test2 { fieldB } }');
    expect(result2.data).toBeUndefined();
  });

  test('can use onTypeConflict to select first type', async () => {
    const stitchedSchema = stitchSchemas({
      subschemas: [schema1, schema2],
      mergeTypes: false,
      onTypeConflict: (left) => left,
    });
    const result1 = await graphql(stitchedSchema, '{ test1 { fieldB } }');
    expect(result1.data?.['test1'].fieldB).toBe('B');
    const result2 = await graphql(stitchedSchema, '{ test1 { fieldC } }');
    expect(result2.data).toBeUndefined();
  });
});

describe('basic type merging', () => {
  let schema1: GraphQLSchema;
  let schema2: GraphQLSchema;

  beforeEach(() => {
    const typeDefs1 = `
      input ObjectInput {
        val: String!
      }

      type Query {
        rootField1: Wrapper
        getTest(id: ID): Test
      }

      type Wrapper {
        test: Test
      }

      type Test {
        id: ID
        field1: String
      }
    `;

    const typeDefs2 = `
      type Query {
        rootField2: Wrapper
        getTest(id: ID): Test
      }

      type Wrapper {
        test: Test
      }

      type Test {
        id: ID
        field2: String
      }
    `;

    schema1 = makeExecutableSchema({
      typeDefs: typeDefs1,
      resolvers: {
        Query: {
          rootField1: () => ({ test: { id: '1' } }),
          getTest: (_parent, { id }) => ({ id }),
        },
        Test: {
          field1: (parent) => parent.id,
        },
      },
    });

    schema2 = makeExecutableSchema({
      typeDefs: typeDefs2,
      resolvers: {
        Query: {
          rootField2: () => ({ test: { id: '2' } }),
          getTest: (_parent, { id }) => ({ id }),
        },
        Test: {
          field2: (parent) => parent.id,
        },
      },
    });
  });

  test('can merge types', async () => {
    const subschemaConfig1: SubschemaConfig = {
      schema: schema1,
      merge: {
        Test: {
          selectionSet: '{ id }',
          resolve: (originalResult, context, info, subschema, selectionSet) =>
            delegateToSchema({
              schema: subschema,
              operation: 'query',
              fieldName: 'getTest',
              args: { id: originalResult.id },
              selectionSet,
              context,
              info,
              skipTypeMerging: true,
            }),
        },
      },
    };

    const subschemaConfig2: SubschemaConfig = {
      schema: schema2,
      merge: {
        Test: {
          selectionSet: '{ id }',
          resolve: (originalResult, context, info, subschema, selectionSet) =>
            delegateToSchema({
              schema: subschema,
              operation: 'query',
              fieldName: 'getTest',
              args: { id: originalResult.id },
              selectionSet,
              context,
              info,
              skipTypeMerging: true,
            }),
        },
      },
    };

    const stitchedSchema = stitchSchemas({
      subschemas: [subschemaConfig1, subschemaConfig2],
    });

    const result = await graphql(
      stitchedSchema,
      `
        {
          rootField1 {
            test {
              field1
              ... on Test {
                field2
              }
            }
          }
        }
      `,
    );

    expect(result).toEqual({
      data: {
        rootField1: {
          test: {
            field1: '1',
            field2: '1',
          },
        },
      },
    });
  });
});

describe('unidirectional type merging', () => {
  let schema1: GraphQLSchema;
  let schema2: GraphQLSchema;

  beforeEach(() => {
    const typeDefs1 = `
      input ObjectInput {
        val: String!
      }

      type Query {
        rootField1: Wrapper
      }

      type Wrapper {
        test: Test
      }

      type Test {
        id: ID
        field1: String
      }
    `;

    const typeDefs2 = `
      type Query {
        rootField2: Wrapper
        getTest(id: ID): Test
      }

      type Wrapper {
        test: Test
      }

      type Test {
        id: ID
        field2: String
      }
    `;

    schema1 = makeExecutableSchema({
      typeDefs: typeDefs1,
      resolvers: {
        Query: {
          rootField1: () => ({ test: { id: '1' } }),
        },
        Test: {
          field1: (parent) => parent.id,
        },
      },
    });

    schema2 = makeExecutableSchema({
      typeDefs: typeDefs2,
      resolvers: {
        Query: {
          rootField2: () => ({ test: { id: '2' } }),
          getTest: (_parent, { id }) => ({ id }),
        },
        Test: {
          field2: (parent) => parent.id,
        },
      },
    });
  });

  test('can merge types unidirectionally if specified', async () => {
    const subschemaConfig1: SubschemaConfig = {
      schema: schema1,
    };

    const subschemaConfig2: SubschemaConfig = {
      schema: schema2,
      merge: {
        Test: {
          selectionSet: '{ id }',
          resolve: (originalResult, context, info, subschema, selectionSet) =>
            delegateToSchema({
              schema: subschema,
              operation: 'query',
              fieldName: 'getTest',
              args: { id: originalResult.id },
              selectionSet,
              context,
              info,
              skipTypeMerging: true,
            }),
        },
      },
    };

    const stitchedSchema = stitchSchemas({
      subschemas: [subschemaConfig1, subschemaConfig2],
    });

    const result = await graphql(
      stitchedSchema,
      `
        {
          rootField1 {
            test {
              field1
              ... on Test {
                field2
              }
            }
          }
        }
      `,
    );

    expect(result).toEqual({
      data: {
        rootField1: {
          test: {
            field1: '1',
            field2: '1',
          },
        },
      },
    });
  });
});

describe('stitchSchemas handles typeDefs with default values', () => {
  test('it works', () => {
    const typeDefs = `
      type Query {
        foo(arg: String = "1"): String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });
    assertValidSchema(schema);

    const stitchedSchema = stitchSchemas({ typeDefs });
    assertValidSchema(stitchedSchema);
  });
});
