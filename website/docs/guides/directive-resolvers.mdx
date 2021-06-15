---
id: directive-resolvers
title: Directive resolvers
description: A set of utilities to build your JavaScript GraphQL schema in a concise and powerful way.
---

## Directive example

Let's take a look at how we can create `@upper` Directive to upper-case a string returned from resolve on Field

To start, let's grab the schema definition string from the `makeExecutableSchema` example [in the "Generating a schema" article](/docs/generate-schema/#example).

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql } from 'graphql';

// Construct a schema, using GraphQL schema language
const typeDefs = `
  directive @upper on FIELD_DEFINITION

  type Query {
    hello: String @upper
  }
`;

// Implement resolvers for out custom Directive
const directiveResolvers = {
  upper(
    next,
    src,
    args,
    context,
  ) {
    return next().then((str) => {
      if (typeof(str) === 'string') {
        return str.toUpperCase();
      }
      return str;
    });
  },
}

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: (root, args, context) => {
      return 'Hello world!';
    },
  },
};

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  directiveResolvers,
});

const query = `
query UPPER_HELLO {
  hello
}
`;

graphql(schema, query).then((result) => console.log('Got result', result));
```

> Note: next() always return a Promise for consistency, resolved with original resolver value or rejected with an error.

## Multi-Directives example

Multi-Directives on a field will be apply with LTR order.

```js
// graphql-tools combines a schema string with resolvers.
import { makeExecutableSchema } from '@graphql-tools/schema';

// Construct a schema, using GraphQL schema language
const typeDefs = `
  directive @upper on FIELD_DEFINITION
  directive @concat(value: String!) on FIELD_DEFINITION

  type Query {
    foo: String @concat(value: "@gmail.com") @upper
  }
`;

// Customs directives, check https://github.com/ardatan/graphql-tools/pull/518
// for more examples
const directiveResolvers = {
  upper(
    next,
    src,
    args,
    context,
  ) {
    return next().then((str) => {
      if (typeof(str) === 'string') {
        return str.toUpperCase();
      }
      return str;
    });
  },
  concat(
    next,
    src,
    args,
    context,
  ) {
    return next().then((str) => {
      if (typeof(str) !== 'undefined') {
        return `${str}${args.value}`;
      }
      return str;
    });
  },
}

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    foo: (root, args, context) => {
      return 'foo';
    },
  },
};

// Required: Export the GraphQL.js schema object as "schema"
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  directiveResolvers,
});
```

The result with query `{foo}` will be:
```json
{
  "data": {
    "foo": "FOO@GMAIL.COM"
  }
}
```

## API

### directiveResolvers option

```js
import { makeExecutableSchema } from '@graphql-tools/schema';

const directiveResolvers = {
  // directive resolvers implement
};

const schema = makeExecutableSchema({
  // ... other options
  directiveResolvers,
})
```

`makeExecutableSchema` has new option field is `directiveResolvers`, a map object for custom Directive's resolvers.

### attachDirectiveResolvers

```js
import { attachDirectiveResolvers } from '@graphql-tools/schema';

const directiveResolvers = {
  // directive resolvers implement
};

schemaWithDirectiveResolvers = attachDirectiveResolvers(
  schema,
  directiveResolvers,
);
```

Given an instance of GraphQLSchema and a `directiveResolvers` map object, `attachDirectiveResolvers` returns a new schema in which all fields' resolver have been wrapped with directive resolvers.
