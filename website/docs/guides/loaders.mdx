---
id: loaders
title: Loaders
sidebar_label: Loaders
---

There are a lot of loaders that load your schemas and documents from different sources. You need to provide those loaders under `loaders` parameter like below;

### GraphQL File Loader

This loader loads your GraphQLSchema from `.graphql` files like below;

```ts
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { addResolversToSchema } from '@graphql-tools/schema';
import { loadSchema } from '@graphql-tools/load';

// schema is `GraphQLSchema` instance
const schema = await loadSchema('schema.graphql', {  // load from a single schema file
    loaders: [
        new GraphQLFileLoader()
    ]
});

// You can add resolvers to that schema
const schemaWithResolvers = addResolversToSchema({
  schema,
  resolvers: {
    Query: {...}
  }
});
```

This loader also supports glob pattern;

```ts
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { loadSchema } from '@graphql-tools/load';

const schema = await loadSchema('graphql/**/*.graphql', {
  // load files and merge them into a single schema object
  loaders: [new GraphQLFileLoader()],
});
```

If you use `loadDocuments`, it gives you an array of document source objects;

```ts
import { loadDocuments } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';

const documents = await loadDocuments('graphql/**/*.graphql', {
  // load files and merge them into a single schema object
  loaders: [new GraphQLFileLoader()],
});
```

> This loader only supports Node environment because it relies on File System of your platform.

### JSON File Loader

This loader handles schema introspection and document nodes in `.json` files.

Introspection is handled in the example below;

```ts
import { loadSchema } from '@graphql-tools/load';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';
import { addMocksToSchema } from '@graphql-tools/mock';

const schema = await loadSchema('schema-introspection.json', {
  loaders: [new JsonFileLoader()],
});

// Mocked non-executable schema generated from an introspection
const mockedSchema = addMocksToSchema({ schema });
```

This loader handles `json` files if they represent `DocumentNode`, and returns an array of document sources.

```ts
import { loadDocuments } from '@graphql-tools/load';
import { JsonFileLoader } from '@graphql-tools/json-file-loader';

const documents = await loadDocuments('**/*-document.json', {
  loaders: [new JsonFileLoader()],
});
```

> This loader only supports Node environment because it relies on File System of your platform.

### Code File Loader

This loader extracts GraphQL SDL string, exported `GraphQLSchema` and `DocumentNode` from TypeScript and JavaScript code files.
Let's say you have the following code file;

```ts
const ME_QUERY = gql`
  query Me {
    me {
      id
      name
      username
      age
    }
  }
`;
```

And the following code will extract `Me` query operation from that code file without executing it using [GraphQL Tag Pluck](/docs/graphql-tag-pluck). It understands `/* GraphQL */` magic comment and `gql` literals. You can configure [GraphQL Tag Pluck](/docs/graphql-tag-pluck) using `pluckConfig`.

```ts
import { loadDocuments } from '@graphql-tools/load';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';

const documents = await loadDocuments('./src/**/graphql/*.ts', {
  loaders:[
    new CodeFileLoader()
  ],
  pluckConfig: {
    ...
  }
})
```

You can also load your schema from code files like below;

```ts
import { GraphQLSchema } from 'graphql';

// typeDefs.ts
export const typeDefs = /* GraphQL */`
  type Query {
    foo: String
  }
`
// or schema.ts
export const schema = new GraphQLSchema(...);
```

> This loader only supports Node environment because it relies on File System of your platform.

**NOTE:** If you are using typescript and [path aliases](https://www.typescriptlang.org/tsconfig#paths), you may also need [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths). Further reading can be found at the [GitHub issue.](https://github.com/ardatan/graphql-tools/issues/1544)

### URL Loader

This loader generates [(a fully executable remote schema using @graphql-tools/wrap)](/docs/remote-schemas) from a URL endpoint.

```ts
import { loadSchema } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';

const schema = await loadSchema('http://localhost:3000/graphql', {
  loaders: [new UrlLoader()],
});
```

You can provide custom headers, HTTP method and custom W3C fetch method.

```ts
import { loadSchema } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';

const schema = await loadSchema('http://localhost:3000/graphql', {
  loaders: [new UrlLoader()],
  headers: {
    Accept: 'application/json',
  },
  method: 'POST',
  fetch: myFetch,
});
```

> This loader supports both browser and node environments.

In browser this remote schema can be called using vanilla GraphQL-js and act like a simple GraphQL client.

```ts
import { loadSchema } from '@graphql-tools/load';
import { UrlLoader } from '@graphql-tools/url-loader';
import { graphql } from 'graphql';

const schema = await loadSchema('http://localhost:3000/graphql', {
  loaders: [new UrlLoader()],
});

const response = await graphql(
  schema,
  /* GraphQL */ `
    {
      foo {
        bar {
          baz
        }
      }
    }
  `
);

console.log(response);
```
