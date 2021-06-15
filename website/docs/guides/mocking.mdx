---
id: mocking
title: Mocking
description: Mock your GraphQL data based on a schema.
---

The strongly-typed nature of a GraphQL API lends itself extremely well to mocking. This is an important part of a GraphQL-First development process, because it enables frontend developers to build out UI components and features without having to wait for a backend implementation.

Even with a backend that is already built, mocking allows you to test your UI without waiting on slow database requests or building out a component harness with a tool like React Storybook.

## Default mock example

Let's take a look at how we can mock a GraphQL schema with just one line of code, using the default mocking logic you get out of the box with `graphql-tools`.

To start, let's grab the schema definition string from the `makeExecutableSchema` example [in the "Generating a schema" article](/docs/generate-schema/#example).

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { graphql } from 'graphql';

// Fill this in with the schema string
const schemaString = `...`;

// Make a GraphQL schema with no resolvers
const schema = makeExecutableSchema({ typeDefs: schemaString });

// Create a new schema with mocks
const schemaWithMocks = addMocksToSchema({ schema });

const query = `
query tasksForUser {
  user(id: 6) { id, name }
}
`;

graphql(schemaWithMocks, query).then((result) => console.log('Got result', result));
```

> Note: If your schema has custom scalar types, you still need to define the `__serialize`, `__parseValue`, and `__parseLiteral` functions, and pass them inside the second argument to `makeExecutableSchema`.

This mocking logic simply looks at your schema and makes sure to return a string where your schema has a string, a number for a number, etc. So you can already get the right shape of result. But if you want to use the mocks to do sophisticated testing, you will likely want to customize them to your particular data model.

## Customizing mocks

This is where the `mocks` option comes in, it's an object that describes your desired mocking logic. This is similar to the `resolverMap` in `makeExecutableSchema`, but has a few extra features aimed at mocking.

It allows you to specify functions that are called for specific types in the schema, for example:

```js
{
  Int: () => 6,
  Float: () => 22.1,
  String: () => 'Hello',
}
```

You can also use this to describe object types, and the fields can be functions too:

```js
{
  Person: () => ({
    name: casual.name(),
    age: casual.integer(0, 120),
  }),
}
```

In this example, we are using [casual](https://github.com/boo1ean/casual), a fake data generator for JavaScript, so that we can get a different result every time the field is called. You might want to use a collection of fake objects, or a generator that always uses a consistent seed, if you are planning to use the data for testing.

### Mocking Custom Scalar Types

In order to Mock Custom Scalar Types, you need to declare them in your Schema. Let's look at an example for declaring DateTime Custom Scalar in our Schema:

```js
const schema = `
  scalar DateTime

  // Your Schema definitions below.
  ...

  ...
`;
```

This will make DateTime Custom Scalar available to be used in the Schema.

The next step is to define a function that returns a value (fixed or random) for the Custom Scalar. Look at the following example, in which we're mocking a **fixed** value for the DateTime Custom Scalar Type:

```js
{
  DateTime: () => '2011-01-05T17:08:49.000-0430'
}
```

Similarly, if you want to mock a **random** value for the Custom Scalar, you can use a library. We're using [casual](https://github.com/boo1ean/casual), as in the example above:

```js
{
  DateTime: () => casual.date(format = 'YYYY-MM-DDTHH:mm:ss.SSSZZ') // Output Example: 2011-11-11T11:43:31.000-0430
}
```

The final step is to use the `mocks` object and `schema` to mock the server.

```js
import { addMocksToSchema, mockServer } from '@graphql-tools/mock';
// Mock object.
const mocks = {
  Int: () => 6,
  Float: () => 22.1,
  String: () => 'Hello',
  DateTime: () => casual.date(format = 'YYYY-MM-DDTHH:mm:ss.SSSZZ')
};
const preserveResolvers = false;
// Mock the server passing the schema, mocks object and preserverResolvers arguments.
const server = mockServer(schema, mocks, preserveResolvers);
// Alternatively, you can call addMocksToSchema with the same arguments.
const schemaWithMocks = addMocksToSchema({
  schema,
  mocks,
  preserveResolvers,
});
```

Now, when you make a Query which response contains the DateTime Scalar Type, the DateTime function will return a value for it.

### Using lists in mocks

To define a mock for a list, simply return an empty array of the desired length as mock value for the field:

```js
{
  Person: () => ({
    // a list of length between 2 and 6
    friends: [...new Array(casual.integer(2, 6))],
    // a list of three lists of two items: [[1, 1], [2, 2], [3, 3]]
    listOfLists: () => [...new Array(3)].map((i) => [...new Array(2)]),
  }),
}
```

#### Abstract types
If you'd like to provide a mock for an `Union` or `Interface` type, you need to provide the type with an extra `__typename`.

```ts
const typeDefs = `
  ...
  union Result = User | Book
`;
const mocks = {
  Result: () => ({
    __typename: 'User',
    name: casual.name(),
  })
}
```

### Applying mutations

Use `resolvers` option of `addMocksToSchema` to implement custom resolvers that interact with the [`MockStore`](#mockstore), especially to mutate field values.

```ts
const typeDefs = `
type User {
  id: Id!
  name: String!
}
type Query {
  me: User!
}
type Mutation {
  changeMyName(newName: String!): User!
}
`
const schema = makeExecutableSchema({ typeDefs: schemaString });
const schemaWithMocks = addMocksToSchema({
  schema,
  resolvers: (store) => ({
    Mutation: {
      changeMyName: (_, { newName }) => {
        // special singleton types `Query` and `Mutation` will use the key `ROOT`

        // this will set the field value for the `User` entity referenced in field
        // `me` of the singleton `Query`
        store.set('Query', 'ROOT', 'me', { name: newName });

        return store.get('Query', 'ROOT', 'me');
      }
    }
  })
});
```

As a result, any query that queries the field `name` of the `User` referenced in `me` will get the updated value.

Note the sugar signature of `set`:

```ts
store.set('Query', 'ROOT', 'me', { name: newName });

// is equivalent to:
const meRef = store.get('Query', 'ROOT', `me`) as Ref;
store.set(meRef, 'name', newName);
```

Usage with `mockServer`:

```ts
const schema = buildSchemaFromTypeDefinitions(typeDefs);
const mySchema = addResolversToSchema(schema, resolvers);
const preserveResolvers = true;

const server = mockServer(mySchema, mocks, preserveResolvers);

// get result from resolvers
const result = await server.query(query, variables);
```

### Handling `*byId` fields

By default, `*byId` (like `userById(id: ID!)`) field will return an entity that does not have the same `id` as the one queried. We can fix that:

```ts
const typeDefs = `
type User {
  id: Id!
  name: String!
}
type Query {
  userById(id: ID!): User!
}
`
const schema = makeExecutableSchema({ typeDefs: schemaString });
const schemaWithMocks = addMocksToSchema({
  schema,
  store,
  resolvers: (store) => ({
    Query {
      userById(_, { id }) => store.get('User', id),
    }
  })
});
```

Note that, by default, the `id` or `_id` field will be used as storage key and the store will make sure the storage key and the field value are equal. You can change the key field using the option `typePolicies`.

### Mocking a pagination

The idea is that the [`MockStore`](#mockstore) contains the full list, as field value, and that the resolver queries the store and slice the result:

```ts
const typeDefs = `
type User {
  id: Id!
  name: String!
  friends(offset: Int!, limit: Int!): [User!]!
}
type Query {
  me: User!
}
`
const schema = makeExecutableSchema({ typeDefs: schemaString });
const schemaWithMocks = addMocksToSchema({
  schema,
  store,
  resolvers: (store) => ({
    User: {
      // `addMocksToSchema` resolver will pass a `Ref` as `parent`
      // it contains a key to the `User` we are dealing with
      friends: (userRef, { offset, limit }) => {
        // this will generate and store a list of `Ref`s to some `User`s
        // next time we go thru this resolver (with same parent), the list
        // will be the same
        const fullList = store.get(userRef, 'friends') as Ref[];

        // actually apply pagination slicing
        return fullList.slice(offset, offset + limit)
      }
    }
  })
});
```

#### Relay-style pagination
The principles stay the same than for basic pagination:

```ts
const typeDefs = `
type User {
  id: Id!
  name: String!
  friends(offset: Int!, limit: Int!): FriendsConnection;
}
type FriendsConnection {
  totalCount: Int!
  edges: [FriendConnectionEdge!]!
}
type FriendsConnectionEdge {
  node: User!
}
type Query {
  me: User!
}
`
const schema = makeExecutableSchema({ typeDefs: schemaString });
const schemaWithMocks = addMocksToSchema({
  schema,
  store,
  resolvers: (store) => ({
    User: {
      friends: (userRef, { offset, limit }) => {

        const connectionRef = store.get(userRef, 'friends', 'edges');

        return {
          totalCount: edgesFullList.length,
          edges: edgesFullList.slice(offset, offset + limit)
      }
    }
  })
});
```

## Mocking a schema using introspection

The GraphQL specification allows clients to introspect the schema with a [special set of types and fields](https://facebook.github.io/graphql/#sec-Introspection) that every schema must include. The results of a [standard introspection query](https://github.com/graphql/graphql-js/blob/master/src/utilities/introspectionQuery.js) can be used to generate an instance of GraphQLSchema which can be mocked as explained above.

This helps when you need to mock a schema defined in a language other than JS, for example Go, Ruby, or Python.

To convert an [introspection query](https://github.com/graphql/graphql-js/blob/master/src/utilities/getIntrospectionQuery.js) result to a `GraphQLSchema` object, you can use the `buildClientSchema` utility from the `graphql` package.

```js
import { buildClientSchema } from 'graphql';
import * as introspectionResult from 'schema.json';

const schema = buildClientSchema(introspectionResult);

const schemaWithMocks = addMocksToSchema({schema});
```

## API

### addMocksToSchema

```js
import { addMocksToSchema } from '@graphql-tools/mock';

const schemaWithMocks = addMocksToSchema({
  schema,
  mocks: {},
  preserveResolvers: false,
});
```

Given an instance of GraphQLSchema and a mock object, `addMocksToSchema` returns a new schema that can return mock data for any valid query that is sent to the server. If `mocks` is not passed, the defaults will be used for each of the scalar types. If `preserveResolvers` is set to `true`, existing resolvers will not be overwritten to provide mock data. This can be used to mock some parts of the server and not others.

### mockServer

```js
import { mockServer } from '@graphql-tools/mock';

// This can be an SDL schema string (eg the result of `buildClientSchema` above)
// or a GraphQLSchema object (eg the result of `buildSchema` from `graphql`)
const schema = `...`

// Same mocks object that `addMocksToSchema` takes above
const mocks = {}
preserveResolvers = false

const server = mockServer(schemaString, mocks, preserveResolvers);

const query = `{ __typename }`
const variables = {}

server.query(query, variables)
  .then(response => {
    console.log(response)
  })
```

`mockServer` is just a convenience wrapper on top of `addMocksToSchema`. It adds your mock resolvers to your schema and returns a client that will correctly execute
your query with variables. **Note**: when executing queries from the returned server,
`context` and `root` will both equal `{}`.

### MockStore

The `MockStore` is holding the generated mocks and can be used to access, generate or alter mocked values.

You can access the `MockStore` either as argument of `resolvers` option of `addMocksToSchema`:

```ts
const schemaWithMocks = addMocksToSchema({
  schema,
  resolvers: (store) => {
    // store is your `MockStore`
    return {
      Query: {
        //... your custom resolvers
      }
    }
  }
  });
```

or by using `createMockStore` (and use the store in `addMocksToSchema`):

```ts
const store = createMockStore({ schema });
const schemaWithMocks = addMocksToSchema({ schema, store });
```

The content is accessible and modifiable via the methods `get` and `set` of the `MockStore`. These methods have several signatures (see [their typing](https://github.com/ardatan/graphql-tools/blob/master/packages/mock/src/types.ts))
but here are some examples:

#### get

Get a field value from the store for the given type, store key and field name. If the the value for this field is not set, a value will be generated according to field return type and mock functions:

```ts
store.get('User', 'abc-737dh-djdjd', 'name')
> "Hello World"
```

If the field is the key field of this type, the store key itself is returned. By default, `id` and `_id` fields are considered as key fields but it can be customized with option `typePolicies`.

```ts
store.get('User', 'abc-737dh-djdjd', 'id')
> "abc-737dh-djdjd"
```

If the field's output type is a `ObjectType` (or list of `ObjectType`), it will return a `Ref` (or array of `Ref`), ie a reference to an entity in the store.

```ts
store.get('User', 'abc-737dh-djdjd', 'organization')
> { $ref: { key: 'acme', typeName: 'Organization' } }
```

`Ref` can then be used, for example to get a field value given of a `Ref`:

```ts
const organizationRef = { $ref: { key: 'acme', typeName: 'Organization' } }
store.get(organizationRef, 'name')
> `Acme Group`
```

As a shortcut, you can traverse the graph quickly with an array of field names (nested get):

```ts
store.get('User', 'abc-737dh-djdjd', ['organization', 'name'])
> `Acme Group`
```

You can generate a entity reference `Ref` with:
```ts
store.get('User', 'abc-737dh-djdjd')
> { $ref: { key: 'abc-737dh-djdjd', typeName: 'User' } }
```

Root types (`Query`, `Mutation`), which necessarily have only one entity, will use the special store key `ROOT` to reference this only entity:

```ts
store.get('Query', 'ROOT', 'viewer');
> { $ref: { key: 'abc-737dh-djdjd', typeName: 'User' } }
```

#### set

Set a field value in the store for the given type, store key and field name:

```ts
store.set('User', '1', 'name', 'Alexandre')

store.get('User', '1', 'name')
> "Alexandre"
```

If the field's output type is a `ObjectType` (or list of `ObjectType`), you can set a `Ref` (or array of `Ref`):
```ts
store.set('User', '1', 'organization', store.get('Organization', 'acme'))
```

You can use a `Ref` to set field name:

```ts
const organizationRef = { $ref: { key: 'acme', typeName: 'Organization' } }
store.set(organizationRef, 'name', 'Acme Group')
```

Set multiple field values at once:
```ts
store.set('User', '1', { name: 'Alexandre', age: 31 })
```

Set a field value via graph traversal (nested set):
```ts
store.get('Query', 'ROOT', {
  viewer: {
    name: 'Alexandre',
    friends: [
      { name: 'Emily' },
      { name: 'Caroline' }
    ]
  },
});
```
#### reset

This method will reset `MockStore`.

```ts
store.reset();
```

## Migration from V7 and below

### Breaking change: Mock functions signature

Mock functions does not receive resolvers' source, arguments and context anymore. Use `resolvers` option of `addMocksToSchema`
to define "true" resolvers that can intract with [`MockStore`](#mockstore).

Example:

```js
// Previously:
const mocks = {
  Person: () => ({
    paginatedFriends: (root, { numPages }) => new MockList(numPages * PAGE_SIZE),
  }),
}
const schemaWithMocks = addMocksToSchema({ schema, mocks });

// Now:
const resolvers = (store) => ({
  Person: {
    paginatedFriends: (root, { numPages }) =>
      store.get(root, 'paginatedFriends').slice(numPages * PAGE_SIZE, (numPages + 1) * PAGE_SIZE),
  }
});
const schemaWithMocks = addMocksToSchema({ schema, resolvers });
```

_Read more about mocking pagination [here](#mocking-a-pagination)_

Mock functions can't return a `Promise` anymore: it has to be a plain value. You can also use resolvers to work around this:

```js
cont getName = () => Promise.resolve('Vlad');
// Previously
const mocks = {
  Person: () => ({
    name: () => getName(),
  }),
}
const schemaWithMocks = addMocksToSchema({ schema, mocks });

// Now:
const resolvers = (store) => ({
  Person: {
    name: async (root) => {
      const name = name = await getName();
      return store.get({
        typeName: root.$ref.typeName,
        key: root.$ref.key,
        fieldName: 'name',
        defaultValue: name,
      })
    }
  }
});
const schemaWithMocks = addMocksToSchema({ schema, resolvers });
```

### Breaking change: preserved resolvers source argument and abstract types mocking

When preserved, resolvers will not receive plain mock data anymore as source but rather a `Ref` that can be used to query the store:

```js
// Previously:
const resolvers = {
  User: {
    name: (data) => {
      return data.name.toLowerCase();
    }
  }
}
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})
const schemaWithMocks = addMocksToSchema({ schema, preserveResolvers: true })

// Now:
let schema = makeExecutableSchema({ typeDefs })
const store = createMockStore({ schema });

const resolvers = {
  User: {
    name: (source) => {
      // `source` is an entity `Ref`
      return store.get(source, 'name').toLowerCase();
    }
  }
}
schema = addResolversToSchema(schema, resolvers)

const schemaWithMocks = addMocksToSchema({ schema, preserveResolvers: true })
```

If you used `__resolveType` resolver for mocking interfaces and unions, rather use `__typename` directly in mocks. See [_Abstract types_](#abstract-types).

Example:

```js
const typeDefs = `
type Query {
  fetchMore(listType: String!, amount: Int!, offset: Int!): List
}

type Distributor {
  id: Int
  name: String
}

type Product {
  id: Int
  name: String
}

interface List {
  amount: Int
  offset: Int
  total: Int
  remaining: Int
}

type DistributorList implements List {
  amount: Int
  offset: Int
  total: Int
  remaining: Int
  items: [Distributor]
}

type ProductList implements List {
  amount: Int
  offset: Int
  total: Int
  remaining: Int
  items: [Product]
}
`

// Previously:
const mocks = {
  List: () => ({
    typename: 'ProductList',
  })
}

const resolvers = {
  List: {
    __resolveType(data) {
      return data.typename
    }
  }
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers
})

const schemaWithMocks = addMocksToSchema({
  schema,
  mocks,
  preserveResolvers: true
})

// Now:
const mocks = {
  List: () => ({
    __typename: 'ProductList',
  })
}

const schema = makeExecutableSchema({ typeDefs });

const schemaWithMocks = addMocksToSchema({ schema, mocks })
```
### Deprecated: MockList

`MockList` is deprecated, use plain arrays instead. See [_Using lists in mocks_](#using-lists-in-mocks).

Example:
```js
// Previously:
const mocks = {
  Person: () => ({
    friends: () => new MockList([2,6]),
    listOfLists: () => new MockList(3, () => new MockList(2)),
  }),
}

// Now:
var casual = require('casual');
const mocks = {
  Person: () => ({
    friends: [...new Array(casual.integer(2, 6))],
    listOfLists: () => [...new Array(3)].map((i) => [...new Array(2)]),
  }),
}
```
