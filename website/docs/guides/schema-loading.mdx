---
id: schema-loading
title: Loading GraphQL Schemas from different sources
sidebar_label: Schema loading
---

These utils are useful for scanning, loading and building a GraphQL schema from any input.

You can specify a GraphQL endpoint, local introspection JSON file, code file that `export`s a GraphQLSchema, AST string and `.graphql` files (with support for `glob` expression).

All found schema files can be merged into a complete schema. There is support for `#import` syntax (formerly known as [`graphql-import`](https://github.com/ardatan/graphql-import)).

The user is given the option of implementing their own loader (implement the interface `SchemaLoader`).

The schema loading util is using loaders, and implemented using [chain-of-responsibility pattern](https://en.wikipedia.org/wiki/Chain-of-responsibility_pattern).

Specifying the loader is not necessary. The user need only provide the inputs. The utils will detect it automatically.

For notes on typescript, refer to [loaders](/docs/loaders)

## Usage

```ts
const { loadSchema } = require('@graphql-tools/load');
const { UrlLoader } = require('@graphql-tools/url-loader');
const { JsonFileLoader } = require('@graphql-tools/json-file-loader');
const { GraphQLFileLoader } = require('@graphql-tools/graphql-file-loader');

const schema1 = await loadSchema('type A { foo: String }');   // load from string w/ no loaders

const schema2 = await loadSchema('http://localhost:3000/graphql', {   // load from endpoint
    loaders: [
        new UrlLoader()
    ]
});

const schema3 = await loadSchema('./schema.json', {   // load from local json file
    loaders: [
        new JsonFileLoader()
    ]
});

const schema4 = await loadSchema('schema.graphql', {  // load from a single schema file
    loaders: [
        new GraphQLFileLoader()
    ]
});

const schema5 = await loadSchema('./src/**/*.graphql', { // load from multiple files using glob
    loaders: [
        new GraphQLFileLoader()
    ]
});
```

### Using `#import` expression

Assume the following directory structure:

```
.
├── schema.graphql
├── posts.graphql
└── comments.graphql
```

`schema.graphql`

```graphql
# import Post from "posts.graphql"

type Query {
  posts: [Post]
}
```

`posts.graphql`

```graphql
# import Comment from 'comments.graphql'

type Post {
  comments: [Comment]
  id: ID!
  text: String!
  tags: [String]
}
```

`comments.graphql`

```graphql
type Comment {
  id: ID!
  text: String!
}
```

Running `loadSchema` produces the following output:

```graphql
type Query {
  posts: [Post]
}

type Post {
  comments: [Comment]
  id: ID!
  text: String!
  tags: [String]
}

type Comment {
  id: ID!
  text: String!
}
```
### Binding to HTTP Server

You can extend loaded schema with resolvers

```ts
import { join } from 'path';
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { addResolversToSchema } from '@graphql-tools/schema';
import * as express from 'express';
import * as graphqlHTTP from 'express-graphql';

// Load schema from the file
const schema = loadSchemaSync(join(__dirname, './schema.graphql'), {
  loaders: [
    new GraphQLFileLoader(),
  ]
});

// Write some resolvers
const resolvers = {};

// Add resolvers to the schema
const schemaWithResolvers = addResolversToSchema({
    schema,
    resolvers,
});

const app = express();

app.use(
    graphqlHTTP({
        schema: schemaWithResolvers,
        graphiql: true,
    })
);

app.listen(4000, () => {
    console.info(`Server listening on http://localhost:4000`)
})

```

> You can learn more about [loaders](/docs/loaders) to load schemas from different sources.
