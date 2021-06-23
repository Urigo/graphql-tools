import '../../../testing/to-be-similar-gql-doc';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { UrlLoader } from '../src';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import nock from 'nock';
import { mockGraphQLServer } from '../../../testing/utils';
import { cwd } from 'process';
import { execute, subscribe, parse, print, ExecutionResult, introspectionFromSchema } from 'graphql';
import { GraphQLUpload } from 'graphql-upload';
import { createReadStream, readFileSync } from 'fs';
import { join } from 'path';
import { useServer } from 'graphql-ws/lib/use/ws';
import { Server as WSServer } from 'ws';
import http from 'http';
import { SubscriptionServer } from 'subscriptions-transport-ws';


describe('Schema URL Loader', () => {
  const loader = new UrlLoader();

  const testTypeDefs = /* GraphQL */ `
schema { query: CustomQuery
mutation: Mutation
subscription: Subscription }
"""The \`Upload\` scalar type represents a file upload."""
scalar Upload
"""Test type comment"""
type CustomQuery {
  """Test field comment"""
  a(testVariable: String): String
}
type Mutation {
  uploadFile(file: Upload, dummyVar: TestInput, secondDummyVar: String): File
}
type File {
  filename: String
  mimetype: String
  encoding: String
  content: String
}
type Subscription {
  testMessage: TestMessage
}
type TestMessage {
  number: Int
}
input TestInput {
  testField: String
}
`.trim();

  const testResolvers = {
    CustomQuery: {
      a: (_: never, { testVariable }: { testVariable: string }) => testVariable || 'a',
    },
    Upload: GraphQLUpload,
    File: {
      content: (file: any) => {
        const stream: NodeJS.ReadableStream = file.createReadStream();
        return new Promise((resolve, reject) => {
          let data = "";

          // eslint-disable-next-line no-return-assign
          stream.on("data", chunk => data += chunk);
          stream.on("end", () => resolve(data));
          stream.on("error", error => reject(error));
        });
      }
    },
    Mutation: {
      uploadFile: async (_: never, { file }: any) => file
    },
    Subscription: {
      testMessage: {
        subscribe: () => {
          const numbers = [0, 1, 2];
          const asyncIterator = {
            next: async () => {
              if (numbers.length === 0) {
                return { value: null, done: true };
              }
              const number = numbers.shift();
              return { value: { number }, done: false };
            }
          };

          return {
            // Note that async iterables use `Symbol.asyncIterator`, **not**
            // `Symbol.iterator`.
            [Symbol.asyncIterator]: () => asyncIterator
          };
        },
        resolve: (payload: any) => payload,
      }
    }
  };

  const testSchema = makeExecutableSchema({ typeDefs: testTypeDefs, resolvers: testResolvers });

  const testHost = `http://localhost:3000`;
  const testPath = '/graphql';
  const testPathChecker = (path: string) => path.startsWith(testPath);
  const testUrl = `${testHost}${testPath}`;

  function assertNonMaybe<T>(input: T): asserts input is Exclude<T, null | undefined>{
    if (input == null) {
      throw new Error("Value should be neither null nor undefined.")
    }
  }

  describe('handle', () => {

    let scope: nock.Scope;
    afterEach(() => {
      if (!scope?.isDone()) {
        scope?.done();
      }
    })

    it('Should throw an error when introspection is not valid', async () => {
      const brokenData = { data: {} };
      scope = nock(testHost).post(testPathChecker).reply(200, brokenData);

      expect.assertions(1);

      try {
        await loader.load(testUrl, {});
      } catch (e) {
        expect(e.message).toBe('Could not obtain introspection result, received: ' + JSON.stringify(brokenData))
      }
    });

    it('Should return a valid schema when request is valid', async () => {
      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker });

      const source = await loader.load(testUrl, {});
      assertNonMaybe(source.schema)
      expect(printSchemaWithDirectives(source.schema)).toBeSimilarGqlDoc(testTypeDefs);
    });

    it('Should pass default headers', async () => {
      let headers: Record<string, string | string[]> = {};

      scope = mockGraphQLServer({
        schema: testSchema,
        host: testHost,
        path: testPathChecker,
        intercept(ctx) {
          headers = ctx.req.headers;
        },
      });

      const source = await loader.load(testUrl, {});

      expect(source).toBeDefined();
      assertNonMaybe(source.schema)
      expect(printSchemaWithDirectives(source.schema)).toBeSimilarGqlDoc(testTypeDefs);

      expect(Array.isArray(headers.accept) ? headers.accept.join(',') : headers.accept).toContain(`application/json`);
      expect(headers['content-type']).toContain(`application/json`);
    });

    it('Should pass extra headers when they are specified as object', async () => {
      let headers: Record<string, string | string[]> = {};
      scope = mockGraphQLServer({
        schema: testSchema,
        host: testHost,
        path: testPathChecker,
        intercept(ctx) {
          headers = ctx.req.headers;
        },
      });

      const source = await loader.load(testUrl, { headers: { Auth: '1' } });

      expect(source).toBeDefined();
      assertNonMaybe(source.schema)
      expect(printSchemaWithDirectives(source.schema)).toBeSimilarGqlDoc(testTypeDefs);

      expect(Array.isArray(headers.accept) ? headers.accept.join(',') : headers.accept).toContain(`application/json`);
      expect(headers['content-type']).toContain(`application/json`);
      expect(headers.auth).toContain(`1`);
    });

    it('Should pass extra headers when they are specified as array', async () => {
      let headers: Record<string, string | string[]> = {};
      scope = mockGraphQLServer({
        schema: testSchema,
        host: testHost,
        path: testPathChecker,
        intercept(ctx) {
          headers = ctx.req.headers;
        },
      });
      const source = await loader.load(testUrl, { headers: [{ A: '1' }, { B: '2', C: '3' }] });

      expect(source).toBeDefined();
      assertNonMaybe(source.schema)
      expect(printSchemaWithDirectives(source.schema)).toBeSimilarGqlDoc(testTypeDefs);

      expect(Array.isArray(headers.accept) ? headers.accept.join(',') : headers.accept).toContain(`application/json`);
      expect(headers['content-type']).toContain(`application/json`);
      expect(headers.a).toContain(`1`);
      expect(headers.b).toContain(`2`);
      expect(headers.c).toContain(`3`);
    });

    it('Should utilize extra introspection options', async () => {
      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker });
      const source = await loader.load(testUrl, { descriptions: false });

      expect(source).toBeDefined();
      assertNonMaybe(source.schema)
      expect(source.schema.getQueryType()!.description).toBeUndefined();
    });

    it('Absolute file path should not be accepted as URL', async () => {
      expect(await loader.canLoad(cwd(), {})).toBeFalsy();
    });
    it('should handle useGETForQueries correctly', async () => {
      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker, method: 'GET' });

      const source = await loader.load(testUrl, {
        descriptions: false,
        useGETForQueries: true,
      });

      const testVariableValue = 'A';

      scope.done();

      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker, method: 'GET' });
      assertNonMaybe(source.schema)
      const result = await execute({
        schema: source.schema,
        document: parse(/* GraphQL */ `
          query TestQuery($testVariable: String) {
            a(testVariable: $testVariable)
          }
        `),
        variableValues: {
          testVariable: testVariableValue,
        },
      });

      scope.done();

      expect(result?.errors).toBeFalsy();

      expect(result?.data?.a).toBe(testVariableValue);
    });

    it('Should preserve "ws" and "http" in the middle of a pointer', async () => {
      const address = {
        host: 'http://foo.ws:8080',
        path: '/graphql',
      };
      const url = address.host + address.path;
      scope = mockGraphQLServer({ schema: testSchema, host: address.host, path: address.path });
      const result = await loader.load(url, {});

      assertNonMaybe(result.schema)
      expect(printSchemaWithDirectives(result.schema)).toBeSimilarGqlDoc(testTypeDefs);
    });

    it('Should replace ws:// with http:// in buildAsyncExecutor', async () => {
      const address = {
        host: 'ws://foo:8080',
        path: '/graphql',
      };
      const url = address.host + address.path;
      scope = mockGraphQLServer({
        schema: testSchema,
        host: address.host.replace('ws', 'http'),
        path: address.path,
      });
      const result = await loader.load(url, {});

      assertNonMaybe(result.schema)
      expect(printSchemaWithDirectives(result.schema)).toBeSimilarGqlDoc(testTypeDefs);
    });

    it('Should replace wss:// with https:// in buildAsyncExecutor', async () => {
      const address = {
        host: 'wss://foo:8080',
        path: '/graphql',
      };
      const url = address.host + address.path;
      scope = mockGraphQLServer({
        schema: testSchema,
        host: address.host.replace('wss', 'https'),
        path: address.path,
      });
      const result = await loader.load(url, {});

      assertNonMaybe(result.schema)
      expect(printSchemaWithDirectives(result.schema)).toBeSimilarGqlDoc(testTypeDefs);
    });
    it('should handle .graphql files', async () => {
      const testHost = 'http://localhost:3000';
      const testPath = '/schema.graphql';
      scope = nock(testHost).get(testPath).reply(200, testTypeDefs);
      const result = await loader.load(testHost + testPath, {});

      assertNonMaybe(result.document)
      expect(print(result.document)).toBeSimilarGqlDoc(testTypeDefs);
    })
    it('should handle results with handleAsSDL option even if it doesn\'t end with .graphql', async () => {
      const testHost = 'http://localhost:3000';
      const testPath = '/sdl';
      scope = nock(testHost).get(testPath).reply(200, testTypeDefs);
      const result = await loader.load(testHost + testPath, {
        handleAsSDL: true,
      });

      assertNonMaybe(result.document)
      expect(print(result.document)).toBeSimilarGqlDoc(testTypeDefs);
    })
    it('should handle subscriptions - new protocol', (done) => {
      Promise.resolve().then(async () => {
        const testUrl = 'http://localhost:8081/graphql';
        const { schema } = await loader.load(testUrl, {
          customFetch: async () => ({
            headers: {
              'content-type': 'application/json'
            },
            json: async () => ({
              data: introspectionFromSchema(testSchema),
            })
          }) as any,
        });

        const httpServer = http.createServer(function weServeSocketsOnly(_, res) {
          res.writeHead(404);
          res.end();
        });

        const wsServer = new WSServer({
          server: httpServer,
          path: '/graphql'
        });

        const subscriptionServer = useServer(
          {
            schema: testSchema, // from the previous step
            execute,
            subscribe,
          },
          wsServer,
        );

        httpServer.listen(8081);
        assertNonMaybe(schema)
        const asyncIterator = await subscribe({
          schema,
          document: parse(/* GraphQL */`
          subscription TestMessage {
            testMessage {
              number
            }
          }
        `),
          contextValue: {},
        }) as AsyncIterableIterator<ExecutionResult>;

        expect(asyncIterator['errors']).toBeFalsy();
        expect(asyncIterator['errors']?.length).toBeFalsy();


        // eslint-disable-next-line no-inner-declarations
        async function getNextResult() {
          const result = await asyncIterator.next();
          expect(result?.done).toBeFalsy();
          return result?.value?.data?.testMessage?.number;
        }

        expect(await getNextResult()).toBe(0);
        expect(await getNextResult()).toBe(1);
        expect(await getNextResult()).toBe(2);

        await asyncIterator.return!();
        await subscriptionServer.dispose();
        wsServer.close(() => {
          httpServer.close(done);
        });
      });
    });
    it('should handle subscriptions - legacy protocol', (done) => {
      Promise.resolve().then(async () => {
        const testUrl = 'http://localhost:8081/graphql';
        const { schema } = await loader.load(testUrl, {
          customFetch: async () => ({
            headers: {
              'content-type': 'application/json'
            },
            json: async () => ({
              data: introspectionFromSchema(testSchema),
            })
          }) as any,
          useWebSocketLegacyProtocol: true,
        });

        const httpServer = http.createServer(function weServeSocketsOnly(_, res) {
          res.writeHead(404);
          res.end();
        });


        httpServer.listen(8081);

        const subscriptionServer = SubscriptionServer.create(
          {
            schema: testSchema,
            execute,
            subscribe,
          },
          {
            server: httpServer,
            path: '/graphql',
          },
        );
        assertNonMaybe(schema)
        const asyncIterator = await subscribe({
          schema,
          document: parse(/* GraphQL */`
          subscription TestMessage {
            testMessage {
              number
            }
          }
        `),
          contextValue: {},
        }) as AsyncIterableIterator<ExecutionResult>;

        expect(asyncIterator['errors']).toBeFalsy();
        expect(asyncIterator['errors']?.length).toBeFalsy();


        // eslint-disable-next-line no-inner-declarations
        async function getNextResult() {
          const result = await asyncIterator.next();
          expect(result?.done).toBeFalsy();
          return result?.value?.data?.testMessage?.number;
        }

        expect(await getNextResult()).toBe(0);
        expect(await getNextResult()).toBe(1);
        expect(await getNextResult()).toBe(2);

        await asyncIterator.return!();
        subscriptionServer.close();
        httpServer.close(done);
      });
    });
    it('should handle multipart requests', async () => {
      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker, method: 'POST' });

      const { schema } = await loader.load(testUrl, {
        multipart: true,
      });

      scope.done();

      scope = mockGraphQLServer({ schema: testSchema, host: testHost, path: testPathChecker, method: 'POST' })

      const fileName = 'testfile.txt';

      const absoluteFilePath = join(__dirname, fileName);
      assertNonMaybe(schema)
      const result = await execute({
        schema,
        document: parse(/* GraphQL */`
          mutation UploadFile($file: Upload!, $nullVar: TestInput, $nonObjectVar: String) {
            uploadFile(file: $file, dummyVar: $nullVar, secondDummyVar: $nonObjectVar) {
              filename
              content
            }
          }
        `),
        variableValues: {
          file: createReadStream(absoluteFilePath),
          nullVar: null,
          nonObjectVar: 'somefilename.txt'
        },
      })

      const content = readFileSync(absoluteFilePath, 'utf8')

      expect(result.errors).toBeFalsy();
      assertNonMaybe(result.data)
      expect(result.data.uploadFile?.filename).toBe(fileName);
      expect(result.data.uploadFile?.content).toBe(content);
    });
  });
});
