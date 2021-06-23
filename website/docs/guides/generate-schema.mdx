---
id: generate-schema
title: Executable schemas
description: Generate a GraphQL schema from the concise type definition language.
---

The graphql-tools package allows you to create a GraphQL.js GraphQLSchema instance from GraphQL schema language using the function `makeExecutableSchema`.

## Example

When using `graphql-tools`, you describe the schema as a GraphQL type language string:

```js
const typeDefs = `
  type Author {
    id: Int!
    firstName: String
    lastName: String
    """
    the list of Posts by this author
    """
    posts: [Post]
  }

  type Post {
    id: Int!
    title: String
    author: Author
    votes: Int
  }

  # the schema allows the following query:
  type Query {
    posts: [Post]
    author(id: Int!): Author
  }

  # this schema allows the following mutation:
  type Mutation {
    upvotePost (
      postId: Int!
    ): Post
  }
`;
```

Then you define resolvers as a nested object that maps type and field names to resolver functions:

```js
import { find, filter } from 'lodash';

// example data
const authors = [
  { id: 1, firstName: 'Tom', lastName: 'Coleman' },
  { id: 2, firstName: 'Sashko', lastName: 'Stubailo' },
  { id: 3, firstName: 'Mikhail', lastName: 'Novikov' },
];

const posts = [
  { id: 1, authorId: 1, title: 'Introduction to GraphQL', votes: 2 },
  { id: 2, authorId: 2, title: 'Welcome to Meteor', votes: 3 },
  { id: 3, authorId: 2, title: 'Advanced GraphQL', votes: 1 },
  { id: 4, authorId: 3, title: 'Launchpad is Cool', votes: 7 },
];

const resolvers = {
  Query: {
    posts: () => posts,
    author: (_, { id }) => find(authors, { id }),
  },

  Mutation: {
    upvotePost: (_, { postId }) => {
      const post = find(posts, { id: postId });
      if (!post) {
        throw new Error(`Couldn't find post with id ${postId}`);
      }
      post.votes += 1;
      return post;
    },
  },

  Author: {
    posts: author => filter(posts, { authorId: author.id }),
  },

  Post: {
    author: post => find(authors, { id: post.authorId }),
  },
};
```

At the end, the schema and resolvers are combined using `makeExecutableSchema`:

```js
import { makeExecutableSchema } from '@graphql-tools/schema';

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
```

This example has the entire type definition in one string and all resolvers in one object, but you can combine types and resolvers from multiple files, as documented in the [extending types](#extending-types) section below.

## Extending Types

It's easy to add additional fields to existing types using the `extend` keyword.  Using `extend` is particularly useful in avoiding a large list of fields on root Queries and Mutations.  You can use it like this:

```js
const typeDefs = [`
  schema {
    query: Query
  }

  type Query {
    bars: [Bar]!
  }

  type Bar {
    id
  }
  `, `
  type Foo {
    id: String!
  }

  extend type Query {
    foos: [Foo]!
  }
`]
```

If one of the types extended needs a resolver you can use `makeExecutableSchema` like this:

```js
const barsResolver = {
  Query: {
    bars(parent, args, context, info) {
      // ...
    }
  }
};

const foosResolver = {
  Query: {
    foos(parent, args, context, info) {
      // ...
    }
  }
}

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: [barsResolver, foosResolver]
})
```

## Learning the GraphQL schema language

The official documentation on graphql.org now has [a section about GraphQL schemas](http://graphql.org/learn/schema/) which explains all of the different schema features and how to use them with the schema language.

The type definitions must define a query type, which means a minimal schema would look something like this:
```js
const typeDefs = [`
  schema {
    query: RootQuery
  }

  type RootQuery {
    aNumber: Int
  }
`];
```

## Descriptions & Deprecations

GraphiQL has built-in support for displaying docstrings with markdown syntax. You can easily add docstrings to types, fields and arguments like below:

```
"""
Description for the type
"""
type MyObjectType {
  """
  Description for field
  Supports multi-line description
  """
  myField: String!

  otherField(
    """
    Description for argument
    """
    arg: Int
  )

  oldField(
    """
    Description for argument
    """
    arg: Int
  ) @deprecated(reason: "Use otherField instead.")
}
```

This [GraphQL schema language cheat sheet](https://raw.githubusercontent.com/sogko/graphql-shorthand-notation-cheat-sheet/master/graphql-shorthand-notation-cheat-sheet.png) by Hafiz Ismail is an excellent reference for all the features of the GraphQL schema language.

## API

### makeExecutableSchema(options)

`makeExecutableSchema` takes a single argument: an object of options. Only the `typeDefs` option is required. It returns a new schema, modified as specified.

```
import { makeExecutableSchema } from '@graphql-tools/schema';

const jsSchema = makeExecutableSchema({
  typeDefs,
  resolvers, // optional
  logger, // optional
  resolverValidationOptions: {}, // optional
  schemaTransforms: [],  // optional
  parseOptions: {},  // optional
  inheritResolversFromInterfaces: false  // optional
});
```

- `typeDefs` is a required argument and should be a GraphQL schema language string or an array of GraphQL schema language strings or a function that takes no arguments and returns an array of GraphQL schema language strings. The order of the strings in the array is not important, but it must include a schema definition.

- `resolvers` is an optional argument _(empty object by default)_ and should be an object or an array of objects that follow the pattern explained in [article on resolvers](/docs/resolvers/)

- `parseOptions` is an optional argument which allows customization of parse when specifying `typeDefs` as a string.

- `resolverValidationOptions` is an optional argument with the following properties, each of which can be set to `error`, `warn`, or `ignore`:
  - `requireResolversForArgs` will cause `makeExecutableSchema` to throw an error (`error`) or issue a warning (`warn`)unless a resolver is defined for every field with arguments. The default is `ignore`, causing this validator to be skipped.

  - `requireResolversForNonScalar` require a resolver for every non-scalar field. Default is `ignore`.

  - `requireResolversForAllFields` asserts that *all* fields have valid resolvers. This option cannot be set in combination with the previous two validators. Default is `ignore`.

  - `requireResolversForResolveType` will require a `resolveType()` method for Interface and Union types. This can be passed in with the field resolvers as `__resolveType()`. Default is `ignore`.

  - `requireResolversToMatchSchema` requires every resolver within the resolver map to correspond to a GraphQL entity within the schema. Defaults to `error`, to help catch common errors.

- `inheritResolversFromInterfaces` GraphQL Objects that implement interfaces will inherit missing resolvers from their interface types defined in the `resolvers` object.

- `schemaTransforms` is an optional argument _(empty array by default)_ and should be an array of schema transformation functions, essentially designed to enable the use of [directive-based functional schema transformation](/docs/schema-directives/)

