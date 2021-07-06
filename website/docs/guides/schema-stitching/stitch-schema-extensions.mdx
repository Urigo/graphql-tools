---
id: stitch-schema-extensions
title: Extending stitched schemas
sidebar_label: Schema extensions
---

Schema extensions add gateway-level type definitions and resolvers into a combined API, which is useful for establishing connections between types that exist in separate subschemas.

When considering these capabilities, be sure to compare them with the newer automated features available through [type merging](/docs/stitch-type-merging). While type merging frequently eliminates the need for schema extensions, it does not preclude their use.

## Basic example

Going back to the posts and users service example:

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';

let postSchema = makeExecutableSchema({
  typeDefs: `
    type Post {
      id: ID!
      text: String
      userId: ID!
    }

    type Query {
      postById(id: ID!): Post
      postsByUserId(userId: ID!): [Post!]!
    }
  `,
});

let userSchema = makeExecutableSchema({
  typeDefs: `
    type User {
      id: ID!
      email: String
    }

    type Query {
      userById(id: ID!): User
    }
  `,
});

// just mock the schemas for now to make them return dummy data
postSchema = addMocksToSchema({ schema: postSchema });
userSchema = addMocksToSchema({ schema: userSchema });

// setup subschema config objects
export const postsSubschema = { schema: postSchema };
export const usersSubschema = { schema: userSchema };
```

We may want to navigate from a particular user to their posts, or from a post to its user. This is possible within our service architecture by connecting an existing key of each object to a corresponding root query:

- `Post.userId -> userById(id)` gets a Post's user.
- `User.id -> postsByUserId(userId)` gets a User's posts.

To formalize this navigation within our gateway schema, we can _extend_ each type with a new field that will translate its respective key into an actual object association:

```js
import { stitchSchemas } from '@graphql-tools/stitch';

export const schema = stitchSchemas({
  subschemas: [postsSubschema, usersSubschema],
  typeDefs: `
    extend type Post {
      user: User!
    }
    extend type User {
      posts: [Post!]!
    }
  `,
});
```

The `typeDefs` option provides type extensions (using the `extend` keyword) that add additional fields into the _combined_ gateway schema, and therefore may cross-reference types from any subschema.

However, these extensions alone won't do anything until they have corresponding resolvers. A complete example would look like this:

```js
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';

export const schema = stitchSchemas({
  subschemas: [postsSubschema, usersSubschema],
  typeDefs: `
    extend type Post {
      user: User!
    }
    extend type User {
      posts: [Post!]!
    }
  `,
  resolvers: {
    User: {
      posts: {
        selectionSet: `{ id }`,
        resolve(user, args, context, info) {
          return delegateToSchema({
            schema: postsSubschema,
            operation: 'query',
            fieldName: 'postsByUserId',
            args: { userId: user.id },
            context,
            info,
          });
        },
      },
    },
    Post: {
      user: {
        selectionSet: `{ userId }`,
        resolve(post, args, context, info) {
          return delegateToSchema({
            schema: usersSubschema,
            operation: 'query',
            fieldName: 'userById',
            args: { id: post.userId },
            context,
            info,
          });
        },
      },
    },
  },
});
```

When resolving `User.posts` and `Post.user`, we _delegate_ each key reference to its corresponding root query. Note that the structure of stitching resolvers has a `selectionSet` property and a `resolve` method.

### selectionSet

```js
Post: {
  user: {
    selectionSet: `{ userId }`,
    // ... resolve
  },
},
```

The `selectionSet` specifies the key field(s) needed from an object to query for its associations. For example, `Post.user` will require that a Post provide its `userId`. Rather than relying on incoming queries to manually request this key for the association, the selection set will automatically be included in subschema requests to guarantee that these fields are fetched. Dynamic selection sets are also possible by providing a function that receives a GraphQL `FieldNode` (the gateway field) and returns a `SelectionSetNode`.

Note: As of version 7 of graphql-tools, `fragment` hints are removed in favor of `selectionSet` hints, read more in migration guide.

### resolve

```js
Post: {
  user: {
    // ... selectionSet
    resolve(post, args, context, info) {
      return delegateToSchema({
        schema: usersSubschema,
        operation: 'query',
        fieldName: 'userById',
        args: { id: post.userId },
        context,
        info,
      });
    },
  },
},
```

Resolvers use the `delegateToSchema` function to forward parts of queries (or even whole new queries) to any other schema&mdash;inside _or outside_ of the stitched schema. When delegating to a stitched subschema, always provide the complete [subschema config](/docs/stitch-combining-schemas#subschema-configs) object as the `schema` option.

By default, `delegateToSchema` assumes that the delegated operation will return the same GraphQL type as the resolved field (ex: a `User` field would delegate to a `User` query). If this is not the case, then you should manually provide a `returnType` option citing the expected GraphQL return type, and transform the result accordingly in the resolver.

## Batch delegation

The drawback of performing individual `delegateToSchema` calls is that they can be fairly inefficient. Say we request `Post.user` from an array of ten posts&mdash;that would delegate ten individual `userById` queries while resolving each user! To improve this, we can instead delegate in _batches_, where many instances of a field resolver are consolidated into one delegation.

To setup batching, the first thing we'll need is a new query in the users service that allows fetching many users at once:

```graphql
usersByIds(ids: [ID!]!): [User]!
```

With this many-users query available, we can now delegate the `Post.user` field in batches across many records:

```js
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { stitchSchemas } from '@graphql-tools/stitch';

const schema = stitchSchemas({
  subschemas: [postsSubschema, usersSubschema],
  typeDefs: `
    extend type Post {
      user: User!
    }
  `,
  resolvers: {
    Post: {
      user: {
        selectionSet: `{ userId }`,
        resolve(post, _args, context, info) {
          return batchDelegateToSchema({
            schema: usersSubschema,
            operation: 'query',
            fieldName: 'usersByIds',
            key: post.userId,
            argsFromKeys: ids => ({ ids }),
            context,
            info,
          });
        },
      },
    },
  },
});
```

Internally, `batchDelegateToSchema` wraps a single `delegateToSchema` call in a [DataLoader](https://www.npmjs.com/package/dataloader) scoped by context, field, arguments, and query selection. It assumes that the delegated operation will return an array of objects matching the gateway field's named GraphQL type (ex: a `User` field delegates to a `[User]` query). If this is not the case, then you should manually provide a `returnType` option citing the expected GraphQL return type. Since it is a thin wrapper around `DataLoader`, it also makes the following assumptions on the results:

> - The Array of values must be the same length as the Array of keys.
> - Each index in the Array of values must correspond to the same index in the Array of keys.

If the query you're delegating to doesn't conform to these expectations, you can provide a custom [valuesFromResults](https://www.graphql-tools.com/docs/api/interfaces/batch_delegate_src.createbatchdelegatefnoptions/#valuesfromresults) function to transform it appropriately.

Batch delegation is generally preferable over plain delegation because it eliminates the redundancy of requesting the same field across an array of parent objects. Even so, delegation costs can add up because there is still one subschema request made _per batched field_&mdash;for remote services, this may create many network requests sent to the same service. Consider enabling an additional layer of network-level batching with a package such as [apollo-link-batch-http](https://www.apollographql.com/docs/link/links/batch-http/) to consolidate requests per subschema.

## Passing gateway arguments

Exhaustive accessors like `User.posts` do not scale well (...what happens when a user has tens of thousands of posts?), so the gateway should probably accept scoping arguments and pass them through to the underlying subschemas. Let's add a `pageNumber` argument to the `User.posts` schema extension:

```graphql
extend type User {
  posts(pageNumber: Int = 1): [Post]!
}
```

This argument only exists in the gateway schema and won't do anything until passed through to subschemas. How we pass this input through depends on which subservice owns the association data...

### Via delegation

First, let's say that the Posts service defines this association. The first thing we'll need is a corresponding argument in the posts query; and while we're at it, let's also support batching:

```graphql
postPagesByUserIds(userIds: [ID!]!, pageNumber: Int=1): [[Post!]!]!
```

This `postPagesByUserIds` query is a very primitive example of pagination, and simply returns an array of posts for each user ID. Now we just need to pass the resolver's page number argument through to `batchDelegateToSchema`, and manually specify a `returnType` that matches the pagination format:

```ts
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';
import { GraphQLList } from 'graphql';

/// ...

User: {
  posts: {
    selectionSet: `{ id }`,
    resolve(user, args, context, info) {
      return batchDelegateToSchema({
        schema: postsSubschema,
        operation: 'query',
        fieldName: 'postPagesByUserIds',
        key: user.id,
        argsFromKeys: (userIds) => ({ userIds, pageNumber: args.pageNumber }),
        returnType: new GraphQLList(new GraphQLList(postsSubschema.schema.getType('Post'))),
        context,
        info,
      });
    },
  },
}
```

### Via selectionSet

Alternatively, let's say that users and posts have a many-to-many relationship and the users service owns the association data. That might give us a `User.postIds` field to stitch from:

```graphql
User.postIds(pageNumber: Int=1): [ID]!
```

In this configuration, resolver arguments will need to pass through with the initial `selectionSet`. The `forwardArgsToSelectionSet` helper handles this:

```js
import { forwardArgsToSelectionSet } from '@graphql-tools/stitch';
import { batchDelegateToSchema } from '@graphql-tools/batch-delegate';

//...
User: {
  posts: {
    selectionSet: forwardArgsToSelectionSet('{ postIds }'),
    resolve(user, args, context, info) {
      return batchDelegateToSchema({
        schema: postsSubschema,
        operation: 'query',
        fieldName: 'postsByIds',
        key: user.postIds,
        argsFromKeys: (ids) => ({ ids }),
        context,
        info,
      });
    },
  },
}
```

By default, `forwardArgsToSelectionSet` will pass through all arguments from the gateway field to _all_ root fields in the selection set. For complex selections that request multiple fields, you may provide an additional mapping of selection names with their respective arguments:

```js
forwardArgsToSelectionSet('{ id postIds }', { postIds: ['pageNumber'] });
```

## Extending transformed schemas

[Transformed schemas](/docs/stitch-combining-schemas#adding-transforms) are nuanced because they involve two versions of the same schema: the original schema, and the transformed gateway schema. When extending a transformed schema, we extend the gateway schema but delegate to the original schema. For example:

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { addMocksToSchema } from '@graphql-tools/mock';
import { stitchSchemas } from '@graphql-tools/stitch';
import { delegateToSchema } from '@graphql-tools/delegate';
import { FilterRootFields, RenameTypes } from '@graphql-tools/wrap';

const postSchema = makeExecutableSchema({
  typeDefs: `
    type Post {
      id: ID!
      text: String
      userId: ID!
    }
    type Query {
      postById(id: ID!): Post
      postsByUserId(userId: ID!): [Post]!
    }
  `,
});

const postsSubschema = {
  schema: addMocksToSchema({ schema: postSchema }),
  transforms: [
    // remove the "postsByUserId" root field
    new FilterRootFields((op, field) => field !== 'postsByUserId'),
    // prefix all type names with "Post_"
    new RenameTypes(name => `Post_${name}`),
  ],
};

const userSchema = makeExecutableSchema({
  typeDefs: `
    type User {
      id: ID!
      email: String
    }

    type Query {
      userById(id: ID!): User
    }
  `,
});

const usersSubschema = {
  schema: addMocksToSchema({ schema: userSchema }),
};

const stitchedSchema = stitchSchemas({
  subschemas: [postsSubschema, usersSubschema],
  typeDefs: `
    extend type User {
      posts: [Post_Post!]!
    }
    extend type Post_Post {
      user: User!
    }
  `,
  resolvers: {
    User: {
      posts: {
        selectionSet: `{ id }`,
        resolve(user, args, context, info) {
          return delegateToSchema({
            schema: postsSubschema,
            operation: 'query',
            fieldName: 'postsByUserId',
            args: { userId: user.id },
            context,
            info,
          });
        },
      },
    },
    Post_Post: {
      user: {
        selectionSet: `{ userId }`,
        resolve(post, args, context, info) {
          return delegateToSchema({
            schema: usersSubschema,
            operation: 'query',
            fieldName: 'userById',
            args: { id: post.userId },
            context,
            info,
          });
        },
      },
    },
  },
});
```

A few key points to note here:

- All schema extensions and their resolvers exist in the gateway schema, and therefore refer to the transformed type name `Post_Post`.

- Delegations refer to the original subschema, and therefore may reference fields such as `postsByUserId` that have been removed from the gateway schema.
