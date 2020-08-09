---
id: merge-typedefs
title: Type definitions (SDL) merging
sidebar_label: Type definitions (SDL) merging
---

Originally implemented in [graphql-modules](https://github.com/Urigo/graphql-modules). This tools merged GraphQL type definitions and schema. It aims to merge all possible types, interfaces, enums and unions, without conflicts.

## Usage

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

### Manually import each type

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

### Import everything from a specified folder

In this way we use the `loadFilesSync` function from `@graphql-tools/load-files` to import all files from the specified folder.

```js
// ./graphql/typeDefs.js
const path = require('path');
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');

const typesArray = loadFilesSync(path.join(__dirname, './types'));

module.exports = mergeTypeDefs(typesArray, { all: true });
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

module.exports = mergeTypeDefs(typesArray, { all: true });
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

module.exports = mergeTypeDefs(typesArray, { all: true })
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

module.exports = mergeTypeDefs(typesArray, { all: true })
```

### Output the string of typeDefs

Since the output of `mergeTypeDefs` is `DocumentNode`, after you merge your types, you can save it to a file to be passed around to other systems. Here is an example using ES6 modules:

```js
const { loadFilesSync } = require('@graphql-tools/load-files');
const { mergeTypeDefs } = require('@graphql-tools/merge');
const { print } = require('graphql');
const fs = require('fs');

const loadedFiles = loadFilesSync(`${__dirname}/schema/**/*.graphql`);
const typeDefs = mergeTypeDefs(loadedFiles, { all: true });
const printedTypeDefs = print(typeDefs);
fs.writeFileSync('joined.graphql', printedTypeDefs);
```

### Merging nested Types

The `mergeTypeDefs` function also allows merging multiple schemas. In the situations where you would like to have multiple
types subfolders, you can merge your types on each subfolder and then everything into one single schema. See the example below:

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

### Merging Directives

Directives will be stacked on top of each other, in the order of declaration.

```js
type Query {
  client: Client @foo
}
type Query {
  client: Client @bar
}
```

Becomes

```
type Query {
  client: Client @foo @bar
}
```
