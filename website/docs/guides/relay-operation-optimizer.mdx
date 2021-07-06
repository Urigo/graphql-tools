---
id: relay-operation-optimizer
title: Optimizing operations using Relay Compiler
sidebar_label: Relay Operation Optimizer
---

`@graphql-tools/relay-operation-optimizer` is a package for bringing the benefits of Relay Compiler to GraphQL tools. This package is used in [`flattenGeneratedTypes` feature of GraphQL Code Generator](https://graphql-code-generator.com/docs/plugins/relay-operation-optimizer).

This package has been created by [Laurin Quast (n1ru4l)](https://github.com/n1ru4l) as [a GraphQL Code Generator plugin](https://github.com/n1ru4l/graphql-codegen-relay-plugins).

### Current List of Features

- [Optimize Queries](https://relay.dev/docs/en/compiler-architecture#transforms) TL;DR: reduce query size
  - Inline Fragments
  - Flatten Transform
  - Skip Redundant Node Transform
- FragmentArguments
  - [`@argumentsDefinition`](https://relay.dev/docs/en/graphql-in-relay#argumentdefinitions)
  - [`@arguments`](https://relay.dev/docs/en/graphql-in-relay#arguments)

## Install Instructions

`yarn add -D -E @graphql-tools/relay-operation-optimizer`

## Usage

> Taken from the blog post [Optimizing your Apollo Operations with GraphQL Code Generator and the Relay Compiler](https://the-guild.dev/blog/graphql-codegen-relay-compiler).

Let’s take a look at the following Fragment:

```graphql
fragment UserAvatar on User {
  id
  avatar(width: 10, height: 10) {
    id
    url
  }
}
```

How would you reuse this fragment with different values for the `width` and `height` arguments?

Previously there have been two ways:

**1. Write a new fragment with different parameters**

Well, just creating a new document for our avatar won’t really solve the reusability issue.

**2. Use variables and rely on the query to have those defined**

Actually, you can already use variables inside fragments. We just need to ensure that the query that uses the fragment also has those variables in the variable definition.

Fragment Definition:

```graphql
fragment UserAvatar on User {
  id
  avatar(width: $width, height: $height) {
    id
    url
  }
}
```

Query Definition:

```graphql
query ProfileQuery($width: Int!, $height: Int!) {
  me {
    ...UserAvatar
  }
}
```

However, we now rely on having those parameters provided in each query that uses that fragment.

This does not really make the fragment reusable. Imagine having a profile query of a with a friend list. The profile picture should be bigger than the ones of the friends.

```graphql
query ProfileQuery($width: Int!, $height: Int!) {
  me {
    id
    ...UserAvatar
    friends(first: 10) {
      id
      ...UserAvatar
    }
  }
}
```

It is basically impossible to use a different width and height for the second usage of the fragment in that query.

Furthermore, when using different fragments you have to be really careful with your variable names, because of variable name clashes.

Given those limitations, it is pretty obvious that this “solution” does not scale well.

Relay simply uses custom GraphQL directives to address this issue.

**Defining Fragment Variables with `@argumentDefinitions`**

```graphql
fragment UserAvatar on User @argumentDefinitions(
  width: { type: “Int”, defaultValue: 10 },
  height: { type: “Int”, defaultValue: 10 }
) {
  id
  avatar(width: $width, height: $height) {
    id
    url
  }
}
```

Providing Fragment Variables with `@arguments`

```graphql
query ProfileQuery {
  me {
    id
    ...UserAvatar @arguments(height: 20, width: 20)
    friends(first: 10) {
      id
      ...UserAvatar # fallback to defaultValue here
    }
  }
}
```

Pretty powerful, right?

Unfortunately, you cannot simply use those fragments with your existing GraphQL Server. `@argumentDefinitions` and `@arguments` are some custom directives that need to be understood by the server in order to process them.

However, instead of implementing those directives on the serverside Relay went another route. The `relay-compiler` removes those directives at build time. That means after our query has been processed it looks something like the following:

```graphql
query ProfileQuery {
  me {
    id
    ... on User {
      id
      avatar(width: 20, height: 20) {
        id
        url
      }
    }
    friends(first: 10) {
      id
      ... on User {
        id
        avatar(width: 10, height: 10) {
          id
          url
        }
      }
    }
  }
}
```

Pretty neat. This allows the query the be accepted by every GraphQL server (that, of course, provides the correct schema), without relying on those custom directives.

**The `relay-compiler` is awesome!**

It comes with a lot more transforms. Some of those are specific to the `relay-runtime` (which as the name says is executed in the browser of the user like react-apollo), but others are definitely also beneficial to non-relay users.

Besides the so-called `RelayApplyFragmentArgumentTransform` there is a bunch of more useful stuff.

E.g. the `FlattenTransform` can improve our query even more:

```graphql
query ProfileQuery {
  me {
    id
    avatar(width: 20, height: 20) {
      id
      url
    }
    friends(first: 10) {
      id
      avatar(width: 10, height: 10) {
        id
        url
      }
    }
  }
}
```

[Laurin Quast](https://github.com/n1ru4l) also built a [relay-compiler REPL](https://relay-compiler-repl.netlify.com/) (use it for convincing your team 😉).

Of course, you can also read more about those in the [Official Relay Documentation](https://relay.dev/docs/en/compiler-architecture#transforms).

Especially on big queries, that utilize many fragments, those transforms can drastically reduce the query payload size, resulting in faster response times. For developers that cannot use persisted queries (because they do not own the server), this is a must-have!
