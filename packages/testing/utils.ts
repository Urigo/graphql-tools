/* eslint-disable */
import { GraphQLSchema } from 'graphql';
import { resolve } from 'path';
import { existsSync } from 'fs';
import nock from 'nock';
import { cwd } from 'process';
import { getGraphQLParameters, processRequest as processGraphQLHelixRequest } from 'graphql-helix';
import { processRequest as processGraphQLUploadRequest } from 'graphql-upload';
import { Request as MockReq } from 'mock-http';
import { jest } from '@jest/globals';

export function normalizeString(str: string) {
  return str.replace(/[\s,]+/g, ' ').trim();
}

type PromiseOf<T extends (...args: any[]) => any> = T extends (...args: any[]) => Promise<infer R> ? R : ReturnType<T>;

export function runTests<
  TResult extends any,
  TArgs extends Array<any>,
  TSync extends (...args: TArgs) => TResult,
  TAsync extends (...args: TArgs) => Promise<TResult>
>({ sync: executeSync, async: executeAsync }: { sync?: TSync; async?: TAsync }) {
  return (
    testRunner: (
      executeFn: (...args: Parameters<TSync | TAsync>) => Promise<PromiseOf<TSync | TAsync>>,
      mode: 'sync' | 'async'
    ) => void
  ) => {
    if (executeSync) {
      // sync
      describe('sync', () => {
        testRunner((...args: Parameters<TSync | TAsync>) => {
          return new Promise<PromiseOf<TAsync>>((resolve, reject) => {
            try {
              const result: any = executeSync(...args);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          });
        }, 'sync');
      });
    }

    if (executeAsync) {
      // async
      describe(`async`, () => {
        testRunner((...args) => executeAsync(...args) as any, 'async');
      });
    }
  };
}

export function useMonorepo({ dirname }: { dirname: string }) {
  const cwd = findProjectDir(dirname);

  return {
    correctCWD() {
      let spyProcessCwd: any;
      beforeEach(() => {
        spyProcessCwd = jest.spyOn(process, 'cwd').mockReturnValue(cwd);
      });
      afterEach(() => {
        spyProcessCwd.mockRestore();
      });
    },
  };
}

function findProjectDir(dirname: string): string | never {
  const originalDirname = dirname;
  const stopDir = resolve(cwd(), '..');

  while (dirname !== stopDir) {
    try {
      if (existsSync(resolve(dirname, 'package.json'))) {
        return dirname;
      }

      dirname = resolve(dirname, '..');
    } catch (e) {
      // ignore
    }
  }

  throw new Error(`Couldn't find project's root from: ${originalDirname}`);
}

export function mockGraphQLServer({
  schema,
  host,
  path,
  intercept,
  method = 'POST',
}: {
  schema: GraphQLSchema;
  host: string;
  path: string | RegExp | ((path: string) => boolean);
  intercept?: (obj: nock.ReplyFnContext) => void;
  method?: string;
}): nock.Scope {
  const handler = async function (this: nock.ReplyFnContext, uri: string, body: any) {
    if (intercept) {
      intercept(this);
    }
    if (this.req.headers['content-type'] && this.req.headers['content-type'][0].includes('multipart/form-data')) {
      this.req.headers['content-type'] = this.req.headers['content-type'][0];
      const httpRequest = new MockReq({
        method: this.req.method,
        url: uri,
        headers: this.req.headers,
        buffer: Buffer.from(body),
      });
      body = await processGraphQLUploadRequest(httpRequest, {
        once: () => {},
      });
    }
    const uriObj = new URL(host + uri);
    const queryObj: any = {};
    uriObj.searchParams.forEach((val, key) => (queryObj[key] = val));
    // Create a generic Request object that can be consumed by Graphql Helix's API
    const request = {
      body,
      headers: this.req.headers,
      method,
      query: queryObj,
    };
    // Extract the GraphQL parameters from the request
    const { operationName, query, variables } = getGraphQLParameters(request);

    // Validate and execute the query
    const result = await processGraphQLHelixRequest({
      operationName,
      query,
      variables,
      request,
      schema,
    });
    // processRequest returns one of three types of results depending on how the server should respond
    // 1) RESPONSE: a regular JSON payload
    // 2) MULTIPART RESPONSE: a multipart response (when @stream or @defer directives are used)
    // 3) PUSH: a stream of events to push back down the client for a subscription
    if (result.type === 'RESPONSE') {
      const headers = new Map<string, string>();
      // We set the provided status and headers and just the send the payload back to the client
      result.headers.forEach(({ name, value }) => headers.set(name, value));
      return [result.status, result.payload, headers];
    } else {
      return [500, 'Not implemented'];
    }
  };
  switch (method) {
    case 'GET':
      return nock(host).get(path).reply(handler);
    case 'POST':
      return nock(host).post(path).reply(handler);
  }
  throw new Error(`Unsupported method: ${method}`);
}
