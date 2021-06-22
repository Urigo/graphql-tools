import { buildSchema, parse, print } from 'graphql';
import { optimizeDocuments } from '@graphql-tools/relay-operation-optimizer';
import '../../testing/to-be-similar-gql-doc';

const testSchema = buildSchema(/* GraphQL */ `
  type Avatar {
    id: ID!
    url: String!
  }

  type User {
    id: ID!
    login: String!
    avatar(height: Int!, width: Int!): Avatar
  }

  type Query {
    user: User!
    users: [User!]!
  }

  directive @connection(key: String!) on FIELD
  directive @client on FIELD
`);

it('can be called', async () => {
  const testDocument = parse(/* GraphQL */ `
    query user {
      user {
        id
      }
    }
  `);
  await optimizeDocuments(testSchema, [testDocument], {});
});

it('can include flattened fragments', async () => {
  const testDocument = parse(/* GraphQL */ `
    fragment UserFragment on User {
      id
    }
    fragment UserFragment2 on User {
      ...UserFragment
      login
    }
  `);
  const result = await optimizeDocuments(testSchema, [testDocument], { includeFragments: true });
  expect(print(result)).toMatchInlineSnapshot(`Array []`);
});

it('can be called with queries that include connection fragments', async () => {
  const testDocument = parse(/* GraphQL */ `
    query user {
      users @connection(key: "foo") {
        id
      }
    }
  `);
  await optimizeDocuments(testSchema, [testDocument], {});
});

it('can inline @argumentDefinitions/@arguments annotated fragments', async () => {
  const fragmentDocument = parse(/* GraphQL */ `
    fragment UserLogin on User
      @argumentDefinitions(height: { type: "Int", defaultValue: 10 }, width: { type: "Int", defaultValue: 10 }) {
      id
      login
      avatar(width: $width, height: $height) {
        id
        url
      }
    }
  `);
  const queryDocument = parse(/* GraphQL */ `
    query user {
      users {
        ...UserLogin @arguments(height: 30, width: 30)
      }
    }
  `);
  const input = [fragmentDocument, queryDocument];
  const output = await optimizeDocuments(testSchema, input, {});
  const queryDoc = output.find(doc => doc.definitions[0].kind === 'OperationDefinition');

  expect(queryDoc).toBeDefined();
  expect(print(queryDoc)).toBeSimilarGqlDoc(/* GraphQL */ `
    query user {
      users {
        id
        login
        avatar(width: 30, height: 30) {
          id
          url
        }
      }
    }
  `);
});

it('handles unions with interfaces the correct way', async () => {
  const schema = buildSchema(/* GraphQL */ `
    type User {
      id: ID!
      login: String!
    }

    interface Error {
      message: String!
    }

    type UserNotFoundError implements Error {
      message: String!
    }

    type UserBlockedError implements Error {
      message: String!
    }

    union UserResult = User | UserNotFoundError | UserBlockedError

    type Query {
      user: UserResult!
    }
  `);

  const queryDocument = parse(/* GraphQL */ `
    query user {
      user {
        ... on User {
          id
          login
        }
        ... on Error {
          message
        }
      }
    }
  `);

  const input = [queryDocument];
  const output = await optimizeDocuments(schema, input, {});
  const queryDoc = output.find(doc => doc.definitions[0].kind === 'OperationDefinition');

  expect(queryDoc).toBeDefined();
  expect(print(queryDoc)).toBeSimilarGqlDoc(/* GraphQL */ `
    query user {
      user {
        ... on User {
          id
          login
        }
        ... on Error {
          message
        }
      }
    }
  `);
});
