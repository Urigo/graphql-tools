import {
  GraphQLSchema,
  subscribe,
  parse,
  graphql,
  execute,
  print,
  ExecutionResult,
  buildSchema,
} from 'graphql';

import { wrapSchema } from '../src/index';

import {
  propertySchema,
  subscriptionSchema,
  subscriptionPubSubTrigger,
  subscriptionPubSub,
  makeSchemaRemote,
} from './fixtures/schemas';

describe('remote queries', () => {
  let schema: GraphQLSchema;
  beforeAll(async () => {
    const remoteSubschemaConfig = await makeSchemaRemote(propertySchema);
    schema = wrapSchema(remoteSubschemaConfig);
  });

  test('should work', async () => {
    const query = `
      {
        interfaceTest(kind: ONE) {
          kind
          testString
          ...on TestImpl1 {
            foo
          }
          ...on TestImpl2 {
            bar
          }
        }
      }
    `;

    const expected = {
      data: {
        interfaceTest: {
          foo: 'foo',
          kind: 'ONE',
          testString: 'test',
        },
      },
    };

    const result = await graphql(schema, query);
    expect(result).toEqual(expected);
  });
});

describe('remote subscriptions', () => {
  let schema: GraphQLSchema;
  beforeAll(async () => {
    const remoteSubschemaConfig = await makeSchemaRemote(subscriptionSchema);
    schema = wrapSchema(remoteSubschemaConfig);
  });

  test('should work', async () => {
    const mockNotification = {
      notifications: {
        text: 'Hello world',
      },
    };

    const subscription = parse(`
      subscription Subscription {
        notifications {
          text
        }
      }
    `);

    const sub = await subscribe(schema, subscription) as AsyncIterableIterator<ExecutionResult>;

    const payload = sub.next();

    await subscriptionPubSub.publish(subscriptionPubSubTrigger, mockNotification);

    expect(await payload).toEqual({ done: false, value: { data: mockNotification } });
  });

  test('should work without triggering multiple times per notification', (done) => {
    const mockNotification = {
      notifications: {
        text: 'Hello world',
      },
    };

    const subscription = parse(`
        subscription Subscription {
          notifications {
            text
          }
        }
      `);

    let notificationCnt = 0;
    const sub1 = subscribe(schema, subscription);
    sub1.then(async (results) => {
      for await (const result of results as AsyncIterable<ExecutionResult>) {
        expect(result).toHaveProperty('data');
        expect(result.data).toEqual(mockNotification);
        notificationCnt++;
      }
    });

    const sub2 = subscribe(schema, subscription);
    sub2.then(async (results) => {
      for await (const result of results as AsyncIterable<ExecutionResult>) {
        expect(result).toHaveProperty('data');
        expect(result.data).toEqual(mockNotification);
      }
    });

    Promise.all([sub1, sub2])
      .then(() => {
        subscriptionPubSub.publish(subscriptionPubSubTrigger, mockNotification);
        subscriptionPubSub.publish(subscriptionPubSubTrigger, mockNotification);
        setTimeout(() => {
          expect(notificationCnt).toBe(2);
          done();
        }, 0);
      })
  });
});

describe('respects buildSchema options', () => {
  const typeDefs = /* GraphQL */`
  type Query {
    # Field description
    custom: CustomScalar!
  }

  # Scalar description
  scalar CustomScalar
`;

  test('without comment descriptions', () => {
    const remoteSchema = wrapSchema({ schema: buildSchema(typeDefs) });

    const customScalar = remoteSchema.getType('CustomScalar');
    expect(customScalar?.description).toBeUndefined();
  });

  test('with comment descriptions', () => {
    const remoteSchema = wrapSchema({
      schema: buildSchema(typeDefs, { commentDescriptions: true }),
    });

    const field = remoteSchema.getQueryType()!.getFields()['custom'];
    expect(field.description).toBe('Field description');
    const customScalar = remoteSchema.getType('CustomScalar');
    expect(customScalar?.description).toBe('Scalar description');
  });

  describe('when query for multiple fields', () => {
    const typeDefs = `
      type Query {
        fieldA: Int!
        fieldB: Int!
        field3: Int!
      }
    `;
    const query = parse(`
      query {
        fieldA
        fieldB
        field3
      }
    `);
    let calls: Array<any> = [];
    const executor = (args: any): any => {
      calls.push(args);
      return Promise.resolve({
        data: {
          fieldA: 1,
          fieldB: 2,
          field3: 3,
        },
      });
    };
    const remoteSchema = wrapSchema({
      schema: buildSchema(typeDefs),
      executor,
    });

    beforeEach(() => {
      calls = [];
    });

    it('forwards three upstream queries', async () => {
      const result = await execute(remoteSchema, query);
      expect(result).toEqual({
        data: {
          fieldA: 1,
          fieldB: 2,
          field3: 3,
        },
      });

      expect(calls).toHaveLength(3);
      expect(print(calls[0].document)).toEqual(`\
{
  fieldA
}
`);
      expect(print(calls[1].document)).toEqual(`\
{
  fieldB
}
`);
      expect(print(calls[2].document)).toEqual(`\
{
  field3
}
`);
    });
  });
});
