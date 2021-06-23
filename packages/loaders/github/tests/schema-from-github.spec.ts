import { printSchema, buildSchema, parse, print } from 'graphql';
import { GithubLoader } from '../src';
import nock from 'nock'

const owner = 'kamilkisiela';
const name = 'graphql-inspector-example';
const ref = 'master';
const path = 'example/schemas/schema.graphqls';
const token = 'MY-SECRET-TOKEN';

const pointer = `github:${owner}/${name}#${ref}:${path}`;

const typeDefs = /* GraphQL */`
  type Post {
    id: ID
    title: String @deprecated(reason: "No more used")
    createdAt: String
    modifiedAt: String
  }
  type Query {
    post: Post!
    posts: [Post!]
  }
`;

function normalize(doc: string): string {
    return print(parse(doc));
}

function assertNonMaybe<T>(input: T): asserts input is Exclude<T, null | undefined>{
  if (input == null) {
    throw new Error("Value should be neither null nor undefined.")
  }
}

test('load schema from GitHub', async () => {
  let params: any = null;

  const server = nock('https://api.github.com').post('/graphql').reply(function reply(_, body: any) {
    params = {
      headers: this.req.headers,
      query: body.query,
      variables: body.variables,
      operationName: body.operationName
    }

    return [200, {
      data: {
        repository: {
          object: {
            text: typeDefs
          }
        }
      }
    }];
  });

  const loader = new GithubLoader();

  const schema = await loader.load(pointer, {
    token,
  });

  server.done();

  assertNonMaybe(params);

  // headers
  expect(params.headers['content-type']).toContain('application/json; charset=utf-8');
  expect(params.headers.authorization).toContain(`bearer ${token}`);

  // query
  expect(normalize(params.query)).toEqual(
    normalize(/* GraphQL */`
      query GetGraphQLSchemaForGraphQLtools($owner: String!, $name: String!, $expression: String!) {
        repository(owner: $owner, name: $name) {
          object(expression: $expression) {
            ... on Blob {
              text
            }
          }
        }
      }
    `),
  );

  // variables
  expect(params.variables).toEqual({
    owner,
    name,
    expression: ref + ':' + path,
  });
  assertNonMaybe(params.operationName)
  // name
  expect(params.operationName).toEqual('GetGraphQLSchemaForGraphQLtools');

  assertNonMaybe(schema.document)
  // schema
  expect(print(schema.document)).toEqual(printSchema(buildSchema(typeDefs)));
});
