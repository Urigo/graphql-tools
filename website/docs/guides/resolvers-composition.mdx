---
id: resolvers-composition
title: Resolvers composition
sidebar_label: Resolvers composition
---

Composition tool for GraphQL, with helpers to combine multiple resolvers into one, specify dependencies between fields, and more.

When developing a GraphQL server, it is common to perform some authorization logic on your resolvers, usually based on the context of a request. With Resolvers Composition you can easily accomplish that and still make the code decoupled - thus testable - by combining multiple single-logic resolvers into one.

The following is an example of a simple logged-in authorization logic:

Instead of doing this,

```js
const resolvers ={
    Query: {
        myQuery: (root, args, context) => {
            // Make sure that the user is authenticated
            if (!context.currentUser) {
                throw new Error('You are not authenticated!');
            }

            // Make sure that the user has the correct roles
            if (!context.currentUser.roles || context.currentUser.roles.includes('EDITOR')) {
                throw new Error('You are not authorized!');
            }

            // Business logic
            if (args.something === '1') {
                return true;
            }

            return false;
        },
    },
};
```

You can do;

```js
const { composeResolvers } = require('@graphql-tools/resolvers-composition');

const resolvers ={
    Query: {
        myQuery: (root, args, context) => {
            if (args.something === '1') {
                return true;
            }

            return false;
        },
    },
};

const isAuthenticated = () => next => async (root, args, context, info) => {
    if (!context.currentUser) {
        throw new Error('You are not authenticated!');
    }

    return next(root, args, context, info);
};

const hasRole = (role: string) => next => async (root, args, context, info) => {
    if (!context.currentUser.roles || context.currentUser.roles.includes(role)) {
        throw new Error('You are not authorized!');
    }

    return next(root, args, context, info);
};

const resolversComposition = {
    'Query.myQuery': [isAuthenticated(), hasRole('EDITOR')],
};

const composedResolvers = composeResolvers(resolvers, resolversComposition);
```

`composeResolvers` is a method in `@graphql-tools/resolvers-composition` package that accepts `IResolvers` object and mappings for composition functions that would be run before resolver itself.
