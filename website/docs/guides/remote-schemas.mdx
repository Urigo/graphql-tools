---
id: remote-schemas
title: Remote schemas
description: Generate GraphQL schema objects that delegate to a remote server
---

It can be valuable to be able to treat remote GraphQL endpoints as if they were local executable schemas. This is especially useful for [schema stitching](/docs/stitch-api/), but there may be other use cases.

There two ways to create remote schemas;

## Use Loaders to load schemas easily

Check out [Schema Loading](/docs/schema-loading) to load schemas from an URL and/or different sources easily without implementing an executor or subscriber.

## Create a remote executable schema with custom executor and subscriber methods

Generally, to create a remote schema, you generally need just three steps:

1. Create a [executor](#creating-an-executor) that can retrieve results from that schema
2. Use [`introspectSchema`](#introspectschemaexecutor-context) to get the non-executable schema of the remote server
3. Use [`wrapSchema`](#wrapschemaschemaconfig) to create a schema that uses the executor to delegate requests to the underlying service

You can optionally also include a [subscriber](#creating-a-subscriber) that can retrieve real time subscription results from the remote schema (only if you are using GraphQL Subscriptions)

### Creating an executor

You can use an executor with an HTTP Client implementation (like cross-fetch). An executor is a function capable of retrieving GraphQL results. It is the same way that a GraphQL Client handles fetching data and is used by several `graphql-tools` features to do introspection or fetch results during execution.

We've chosen to split this functionality up to give you the flexibility to choose when to do the introspection step. For example, you might already have the remote schema information, allowing you to skip the `introspectSchema` step entirely. Here's a complete example:

```js
type Executor = (operation: ExecutionParams) => Promise<ExecutionResult>;

type ExecutionParams = {
  document: DocumentNode,
  variables?: Object,
  context?: Object,
  info?: GraphQLResolveInfo,
};
```

### Using cross-fetch

Basic usage

```js
import { fetch } from 'cross-fetch';
import { print } from 'graphql';
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';

const executor = async ({ document, variables }) => {
  const query = print(document);
  const fetchResult = await fetch('http://example.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return fetchResult.json();
};

export default async () => {
  const schema = wrapSchema({
    schema: await introspectSchema(executor),
    executor,
  });
  return schema;
};
```

Authentication headers from context

```js
import { fetch } from 'cross-fetch';
import { print } from 'graphql';
import { introspectSchema, wrapSchema } from '@graphql-tools/wrap';

const executor = async ({ document, variables, context }) => {
  const query = print(document);
  const fetchResult = await fetch('http://example.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.authKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  return fetchResult.json();
};

export default async () => {
  const schema = wrapSchema({
    schema: await introspectSchema(executor),
    executor,
  });

  return schema;
};
```

### Creating a subscriber

For subscriptions, we need to define a subscriber that returns `AsyncIterator`. Other than that, it has the similar API with `executor`.

```ts
type Subscriber = (executionParams: ExecutionParams) => Promise<AsyncIterator<ExecutionResult>>;
```

#### Using `graphql-ws`

For the following example to work, the server must implement the [library's transport protocol](https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md). Learn more about [`graphql-ws`](https://github.com/enisdenjo/graphql-ws).

```ts
import { wrapSchema, introspectSchema } from '@graphql-tools/wrap';
import { Executor, Subscriber } from '@graphql-tools/delegate';
import { fetch } from 'cross-fetch';
import { print } from 'graphql';
import { observableToAsyncIterable } from '@graphql-tools/utils';
import { createClient } from 'graphql-ws';

const HTTP_GRAPHQL_ENDPOINT = 'http://localhost:3000/graphql';
const WS_GRAPHQL_ENDPOINT = 'ws://localhost:3000/graphql';

const executor: Executor = async ({ document, variables }) => {
  const query = print(document);
  const fetchResult = await fetch(HTTP_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  return fetchResult.json();
};

const subscriptionClient = createClient({
  url: WS_GRAPHQL_ENDPOINT,
});

const subscriber: Subscriber = ({ document, variables }) =>
  observableToAsyncIterable({
    subscribe: observer => ({
      unsubscribe: subscriptionClient.subscribe(
        {
          query: document,
          variables,
        },
        {
          next: data => observer.next && observer.next(data),
          error: err => {
            if (!observer.error) return;
            if (err instanceof Error) {
              observer.error(err);
            } else if (err instanceof CloseEvent) {
              observer.error(new Error(`Socket closed with event ${err.code}`));
            } else {
              // GraphQLError[]
              observer.error(new Error(err.map(({ message }) => message).join(', ')));
            }
          },
          complete: () => observer.complete && observer.complete(),
        }
      ),
    }),
  });

export default async () => {
  const schema = wrapSchema({
    schema: await introspectSchema(executor),
    executor,
    subscriber,
  });

  return schema;
};
```

## API

### introspectSchema(executor, [context])

Use `executor` to obtain a non-executable client schema from a remote schema using a full introspection query. `introspectSchema` is used to acquire the non-executable form of a remote schema that must be passed to `wrapSchema`. It returns a promise to a non-executable GraphQL.js schema object. Accepts optional second argument `context`, which is passed to the executor; see the docs about executors above for more details.

```js
import { introspectSchema } from '@graphql-tools/wrap';

introspectSchema(executor).then(schema => {
  // use the schema
});

// or, with async/await:
const schema = await introspectSchema(executor);
```

### wrapSchema(schemaConfig)

`wrapSchema` comes most in handy when wrapping a remote schema. When using the function to wrap a remote schema, it takes a single object: an subschema configuration object with properties describing how the schema should be accessed and wrapped. The `schema` and `executor` options are required.

```js
import { wrapSchema } from '@graphql-tools/wrap';

const schema = wrapSchema({
  schema,
  executor,
  transforms,
});
```

Transforms are further described within the [general schema wrapping section](/docs/schema-wrapping/). When using a schema configuration object, transforms should be placed as a property within the configuration, rather than as a separate argument to `wrapSchema`.

Batching and caching can be accomplished by specifying customized executors that manage this for you. We export a `linkToExecutor` function in `@graphql-tools/links` package that can be used to transform the [`HTTPLinkDataloader`](https://github.com/prisma-labs/http-link-dataloader) Apollo-style link (created by Prisma) that will batch and cache all requests. Per request caching is a simple add-on, as the `executor` function is provided the context, so a global `executor` specified by wrapSchema can simply forward all arguments to a request-specific `executor` provided on the context.

For users who need to customize the root proxying resolvers at the time that the wrapping schema is generated, you can also specify a custom `createProxyingResolver` function that will create your own root resolvers for the new outer, wrapping schema. This function has the following signature:

```ts
export type CreateProxyingResolverFn = (options: ICreateProxyingResolverOptions) => GraphQLFieldResolver<any, any>;

export interface ICreateProxyingResolverOptions {
  subschemaConfig: SubschemaConfig; // target schema config for delegation
  transformedSchema?: GraphQLSchema; // pre-processed result of applying any transforms to the target schema
  operation?: Operation; // target operation type = 'query' | 'mutation' | 'subscription'
  fieldName?: string; // target root field name
}
```

You may not need all the options to accomplish what you need. For example, the default proxying resolver creator just uses a subset of the passed arguments, with the fieldName inferred:

```ts
import { delegateToSchema } from '@graphql-tools/delegate';

export function defaultCreateProxyingResolver({
  subschemaConfig,
  operation,
  transforms,
  transformedSchema,
}: ICreateProxyingResolverOptions): GraphQLFieldResolver<any, any> {
  return (_parent, _args, context, info) =>
    delegateToSchema({
      schema: subschemaConfig,
      operation,
      context,
      info,
      transformedSchema,
    });
}
```

Parenthetically, note that that `args` from the root field resolver are not directly passed to the target schema. These arguments have already been parsed into their corresponding internal values by the GraphQL execution algorithm. The correct, serialized form of the arguments are available within the `info` object, ready for proxying. Specifying the `args` property for `delegateToSchema` allows one to pass _additional_ arguments to the target schema, which is not necessary when creating a simple proxying schema.

The above can can all be put together like this:

```ts
import { wrapSchema } from '@graphql-tools/wrap';

const schema = wrapSchema({
  schema,
  executor: myCustomExecutor,
  createProxyingResolver: myCustomCreateProxyingResolverFn,
});
```

Note that within the `defaultCreateProxyingResolver` function, `delegateToSchema` receives `executor` and `subscriber` functions stored on the subschema config object originally passed to `wrapSchema`. As above, use of the the `createProxyingResolver` option is helpful when you want to customize additional functionality at resolver creation time. If you just want to customize how things are proxied at the time that they are proxied, you can make do just with custom executors and subscribers.

### makeRemoteExecutableSchema(options)

What about `makeRemoteExecutableSchema`, the function used in older versions to access remote schemas? It still works -- just now under the hood calling `wrapSchema`. There is essentially no longer any need to use `makeRemoteExecutableSchema` directly, but we've kept it around for backwards compatibility.

You can still pass a `createResolver` function to `makeRemoteExecutableSchema` to override how the fetch resolvers are created and executed. The `createResolver` param accepts an `Executor` as its first argument (and a `Subscriber` as its second) and returns a resolver function. This opens up the possibility for users to create batching mechanisms for fetches. As above, it is likely easier to just customize the `executor` function itself.

Given a GraphQL.js schema (can be a non-executable client schema made by `buildClientSchema`) and a [executor](#creating-an-executor), `makeRemoteExecutableSchema` produce a GraphQL Schema that routes all requests to the executor:

```js
import { makeRemoteExecutableSchema } from '@graphql-tools/wrap';

const createResolver: (executor: Executor) => GraphQLFieldResolver<any, any> = // . . .

const schema = makeRemoteExecutableSchema({
  schema,
  executor,
  createResolver
});
```
