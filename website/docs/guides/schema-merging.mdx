---
id: schema-merging
title: Schema merging
sidebar_label: Schema merging
---

Schema merging (`@graphql-tools/merge`) consolidates the type definitions and resolvers from many local schema instances into a single executable schema. This is useful for building a single local service schema from many individually-managed parts. This should not be confused with [schema stitching](/docs/stitch-combining-schemas), which builds a combined proxy schema atop numerous subservice APIs.

## Getting started

You can use `mergeSchemas` to merge `GraphQLSchema` objects together with extra `typeDefs` and `resolvers`.

```ts
const { mergeSchemas } = require('@graphql-tools/merge');

const mergedSchema = mergeSchemas({
  schemas: [
    BarSchema,
    BazSchema,
  ],
  typeDefs: `
    type ExtraType {
      foo: String
    }
  `,
  resolvers: {
    ExtraType: {
      foo: () => 'FOO',
    }
  }
});
```

There is also `mergeSchemasAsync` as a faster asynchronous alternative.

## Merging type definitions

Originally implemented in [graphql-modules](https://github.com/Urigo/graphql-modules). This tool merges GraphQL type definitions and schema. It aims to merge all possible types, interfaces, enums and unions, without conflicts.

Let's say this is your current schema:

```graphql
type Client {
  id: ID!
  name: String
  age: Int
  products: [Product]
}

type Product {
  id: ID!
  description: String
  price: Int
}

type Query {
  clients: [Client]
  client(id: ID!): Client
  products: [Product]
  product(id: ID!): Product
}

type Mutation {
  addClient(name: String!, age: Int!): Client
}
```

Knowing that your app will grow, you want to move your definitions to separate files that should look like the following.

```js
// ./graphql/types/clientType.js
module.exports = `
  type Client {
    id: ID!
    name: String
    age: Int
    products: [Product]
  }

  type Query {
    clients: [Client]
    client(id: ID!): Client
  }

  type Mutation {
    addClient(name: String!, age: Int!): Client
  }
`;

// ./graphql/types/productType.js
module.exports =  `
  type Product {
    id: ID!
    description: String
    price: Int
    client: Client
  }

  type Query {
    products: [Product]
    product(id: ID!): Product
  }
`;
```

There are two ways you can use this package:
  * manually import each type
  * import everything from a specified folder

### Manual imports

If you decide to have manual control of each file that gets merged, all you need is the `mergeTypeDefs(types)` function from `@graphql-tools/merge` package:

```js
const { mergeTypeDefs } = require('@graphql-tools/merge');
const clientType = require('./clientType');
const productType = require('./productType');

const types = [
  clientType,
  productType,
];

module.exports = mergeTypeDefs(types);
```

See [`mergeTypeDefs`](https://www.graphql-tools.com/docs/api/modules/merge/#mergetypedefs) for more details.

### File loading

In this way we use the `loadFilesSync` function from `@graphql-tools/load-files` to import all files from the specified folder.

```js
// ./graphql/typeDefs.js
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');

const typesArray = loadFilesSync(path.join(__dirname, './types'));

module.exports = mergeTypeDefs(typesArray);
```
When using the `loadFilesSync` function you can also implement your type definitions using `.graphql` or `.gql` or `.graphqls` files.

You can also load files with specified extensions by setting the extensions option.
Only these values are supported now. `'ts', 'js', 'gql', 'graphql', 'graphqls'`
```js
// ./graphql/typeDefs.js
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');

const typesArray = loadFilesSync(path.join(__dirname, './types'), { extensions: ['graphql'] });

module.exports = mergeTypeDefs(typesArray);
```

> By default, the `loadFilesSync` function will not ignore files named `index.js` or `index.ts`, but you can set the `ignoreIndex` option to `true` to enable this behavior. This allows you to create your index file inside the actual types folder if desired.

```graphql
# ./graphql/types/clientType.graphql
type Client {
  id: ID!
  name: String
  age: Int
  products: [Product]
}

type Query {
  clients: [Client]
  client(id: ID!): Client
}

type Mutation {
  addClient(name: String!, age: Int!): Client
}

# ./graphql/types/productType.graphql
type Product {
  id: ID!
  description: String
  price: Int
  client: Client
}

type Query {
  products: [Product]
  product(id: ID!): Product
}
```

You can also load files in nested folders by setting the `recursive` option.

Given the file structure below:

```
+-- graphql
|   +-- types
|   |   +-- subGroupA
|   |   |   +-- typeA1.graphql
|   |   |   +-- typeA2.graphql
|   |   +-- subGroupB
|   |   |   +-- typeB1.graphql
|   |   |   +-- typeB2.graphql
|   |   +-- index.js
```

Here's how your `index` file could look like:

```js
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');

const typesArray = loadFilesSync(path.join(__dirname, '.'), { recursive: true })

module.exports = mergeTypeDefs(typesArray)
```

You can also load files in different folders by passing a glob pattern in `loadFilesSync`.

Given the file structure below:
```
+-- graphql
|   +-- subGroupA
|   |   +-- typeA1.graphql
|   |   +-- typeA2.graphql
|   +-- subGroupB
|   |   +-- typeB1.graphql
|   |   +-- typeB2.graphql
|   +-- index.js
```

Here's how your `index` file could look like:

```js
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');

const typesArray = loadFilesSync(path.join(__dirname, 'graphql/**/*.graphql'))

module.exports = mergeTypeDefs(typesArray)
```

### Print merged typeDefs

Since the output of `mergeTypeDefs` is a GraphQL `DocumentNode`, you may print the merged result as a string to be passed around to other systems. For example:

```js
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { print } = require('graphql');
const fs = require('fs');

const loadedFiles = loadFilesSync(`${__dirname}/schema/**/*.graphql`);
const typeDefs = mergeTypeDefs(loadedFiles);
const printedTypeDefs = print(typeDefs);
fs.writeFileSync('joined.graphql', printedTypeDefs);
```

### Nested Types

The `mergeTypeDefs` function also allows merging multiple schemas. In situations where you would like to have nested subfolders, you can merge your types by subfolder, and then everything into one single schema. For example:

```
+-- graphql
|   +-- types
|   |   +-- subGroupA
|   |   |   +-- index.js <<< Merges all types in subGroupA
|   |   |   +-- typeA1.graphql
|   |   |   +-- typeA2.graphql
|   |   +-- subGroupB
|   |   |   +-- index.js <<< Merges all types in subGroupB
|   |   |   +-- typeB1.graphql
|   |   |   +-- typeB2.graphql
|   |   +-- index.js <<< Merges exports from subGroupA and subGroupB
```

### Directives

Merged directives will be stacked on top of each other, in the order of declaration. For example:

```js
type Query {
  client: Client @foo
}
type Query {
  client: Client @bar
}
```

Becomes:

```
type Query {
  client: Client @foo @bar
}
```

## Merging resolvers

Resolvers are implemented as simple JS objects and then merged using deep-merge. Resolver implementations can be separated across multiple objects and then merged into a single `resolvers` object. Following the previous examples, for the types we implemented our resolvers should look like the following:

```js
// ./graphql/resolvers/clientResolver.js
module.exports = {
  Query: {
    clients: () => {},
    client: () => {},
  },
  Mutation: {
    addClient: () => {},
  },
  Client: {
    products: () => {},
  },
}

// ./graphql/resolvers/productResolver.js
module.exports = {
  Query: {
    products: () => {},
    product: () => {},
  },
  Product: {
    client: () => {},
  },
}
```

Just like your type definitions, you can choose to import files manually:

```js
// ./graphql/resolvers/index.js
const { mergeResolvers } = require('@graphql-tools/merge');
const clientResolver = require('./clientResolver');
const productResolver = require('./productResolver');

const resolvers = [
  clientResolver,
  productResolver,
];

module.exports = mergeResolvers(resolvers);
```
Or automatically:

```js
// ./graphql/resolvers.js
const path = require('path');
const { mergeResolvers } = require('@graphql-tools/merge');
const { loadFilesSync } = require('@graphql-tools/load-files');

const resolversArray = loadFilesSync(path.join(__dirname, './resolvers'));

module.exports = mergeResolvers(resolversArray);
```

> Beware that `mergeResolvers` is simply merging plain JavaScript objects together.
This means that you should be careful with Queries, Mutations or Subscriptions with naming conflicts.

You can also load files with specified extensions by setting the extensions option.
Only these values are supported now: `ts, js, gql, graphql, graphqls`.
```js
// ./graphql/resolvers.js
const path = require('path');
const { mergeResolvers } = require('@graphql-tools/merge');
const { loadFilesSync } = require('@graphql-tools/load-files');

const resolversArray = loadFilesSync(path.join(__dirname, './resolvers'), { extensions: ['js'] });

module.exports = mergeResolvers(resolversArray);
```

**Optional: Automatic with Resolver Naming Convention**

If you would like to use the automated `fileLoader` approach _but_ would like complete
freedom over the structure of your resolver files, then simply use a resolver file naming
convention like, `[file].resolvers.js/ts`.

Then setup your `fileLoader` like so, and you're in business:

```js
// ./graphql/resolvers/index.js/ts
const path = require('path');
const { mergeResolvers } = require('@graphql-tools/merge');
const { loadFilesSync } = require('@graphql-tools/load-files');

const resolversArray = loadFilesSync(path.join(__dirname, "./**/*.resolvers.*"));
module.exports = mergeResolvers(resolversArray);
```
With this approach, you're free to structure resolver files as you see fit. Of course,
unique naming of Queries, Mutations and Subscriptions still applies!

Now you can structure by **function**...
```
+-- graphql
|   +-- resolvers
|   |   +-- author.resolvers.js/ts
|   |   +-- book.resolvers.js/ts
|   |   +-- index.ts  <<< Merges all `*.resolvers.*` files
```

Or by **type**...
```
+-- graphql
|   +-- entity
|   |   +-- author
|   |   |   +-- author.resolvers.js/ts
|   |   |   +-- ...
|   |   +-- book
|   |   |   +-- book.resolvers.js/ts
|   |   |   +-- ...
|   |   +-- index.ts <<< Merges all `*.resolvers.*` files
```

**Custom extraction from exports**

By default, `loadFiles` checks export names `typeDefs`, `resolvers` and `schema`. But you can change the way it extracts the content from the exported values.

Let's say you have a factory function inside your resolvers like below;

```js
module.exports = customQueryTypeName = ({
  [customQueryTypeName]: {
    foo: () => 'FOO',
  }
})
```

And you can define custom `extractExports` like below;
```js
const { loadFilesSync } = require('@graphql-tools/load-files');

const resolvers = loadFilesSync(join(__dirname, './resolvers/**/*.js'), {
  extractExports: fileExport => {
    if (typeof fileExport === 'function') {
      return fileExport('query_root');
    }
    return fileExport;
  }
})
```
