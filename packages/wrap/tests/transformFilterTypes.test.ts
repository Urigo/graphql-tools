import { wrapSchema, FilterTypes } from '@graphql-tools/wrap';
import { graphql, GraphQLSchema, GraphQLNamedType } from 'graphql';
import { assertSome } from '@graphql-tools/utils';
import { bookingSchema } from './fixtures/schemas';

describe('FilterTypes', () => {
  let schema: GraphQLSchema;
  beforeAll(() => {
    const typeNames = ['ID', 'String', 'DateTime', 'Query', 'Booking'];
    const transforms = [
      new FilterTypes(
        (type: GraphQLNamedType) => typeNames.indexOf(type.name) >= 0,
      ),
    ];
    schema = wrapSchema({
      schema: bookingSchema,
      transforms
    });
  });

  test('should work normally', async () => {
    const result = await graphql(
      schema,
      `
        query {
          bookingById(id: "b1") {
            id
            propertyId
            startTime
            endTime
          }
        }
      `,
    );

    expect(result).toEqual({
      data: {
        bookingById: {
          endTime: '2016-06-03',
          id: 'b1',
          propertyId: 'p1',
          startTime: '2016-05-04',
        },
      },
    });
  });

  test('should error on removed types', async () => {
    const result = await graphql(
      schema,
      `
        query {
          bookingById(id: "b1") {
            id
            propertyId
            startTime
            endTime
            customer {
              id
            }
          }
        }
      `,
    );
    expect(result.errors).toBeDefined();
    assertSome(result.errors)
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].message).toBe(
      'Cannot query field "customer" on type "Booking".',
    );
  });
});
