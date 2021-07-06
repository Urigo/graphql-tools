---
id: scalars
title: Custom scalars and enums
description: Add custom scalar and enum types to your graphql-tools generated schema.
---

The GraphQL specification includes the following default scalar types: `Int`, `Float`, `String`, `Boolean` and `ID`. While this covers most of the use cases, often you need to support custom atomic data types (e.g. Date), or you want a version of an existing type that does some validation. To enable this, GraphQL allows you to define custom scalar types. Enumerations are similar to custom scalars, but their values can only be one of a pre-defined list of strings.

## Custom scalars

To define a custom scalar you simply add it to the schema string with the following notation:

```js
scalar MyCustomScalar
```

Afterwards, you have to define the behavior of your `MyCustomScalar` custom scalar by passing an instance of the [`GraphQLScalarType`](http://graphql.org/graphql-js/type/#graphqlscalartype) class in the [resolver map](/docs/resolvers/#resolver-map). This instance can be defined in a [dependency package](#using-a-package) or [in your own code](#custom-graphqlscalartype-instance).

For more information about GraphQL's type system, please refer to the [official documentation](http://graphql.org/graphql-js/type/) or to the [Learning GraphQL](https://github.com/mugli/learning-graphql/blob/master/7.%20Deep%20Dive%20into%20GraphQL%20Type%20System.md) tutorial.

Note that most of popular GraphQL clients does not currently have a way to automatically interpret custom scalars, so there's no way to automatically reverse the serialization on the client.

### Using a package

Here, we'll take the [graphql-scalars](https://github.com/Urigo/graphql-scalars) package as an example to demonstrate what can be done. This npm package defines a JSON GraphQL scalar type.

Add the `graphql-scalars` package to your project's dependencies :

```shell
$ npm install --save graphql-scalars
```

In your JavaScript code, require the type defined by in the npm package and use it :

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { GraphQLJSON } from 'graphql-scalars';

const schemaString = `

scalar JSON

type Foo {
  aField: JSON
}

type Query {
  foo: Foo
}

`;

const resolveFunctions = {
  JSON: GraphQLJSON,
};

const jsSchema = makeExecutableSchema({ typeDefs: schemaString, resolvers: resolveFunctions });
```

Remark : `GraphQLJSON` is a [`GraphQLScalarType`](http://graphql.org/graphql-js/type/#graphqlscalartype) instance.

For a set of popular scalar types that are ready to reuse, try out the [GraphQL Scalars npm library](https://github.com/urigo/graphql-scalars).

### Custom `GraphQLScalarType` instance

If needed, you can define your own [GraphQLScalarType](http://graphql.org/graphql-js/type/#graphqlscalartype) instance. This can be done the following way :

```js
import { GraphQLScalarType } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';

const myCustomScalarType = new GraphQLScalarType({
  name: 'MyCustomScalar',
  description: 'Description of my custom scalar type',
  serialize(value) {
    let result;
    // Implement your own behavior here by setting the 'result' variable
    return result;
  },
  parseValue(value) {
    let result;
    // Implement your own behavior here by setting the 'result' variable
    return result;
  },
  parseLiteral(ast) {
    switch (
      ast.kind
      // Implement your own behavior here by returning what suits your needs
      // depending on ast.kind
    ) {
    }
  },
});

const schemaString = `

scalar MyCustomScalar

type Foo {
  aField: MyCustomScalar
}

type Query {
  foo: Foo
}

`;

const resolverFunctions = {
  MyCustomScalar: myCustomScalarType,
};

const jsSchema = makeExecutableSchema({
  typeDefs: schemaString,
  resolvers: resolverFunctions,
});
```

## Custom scalar examples

Let's look at a couple of examples to demonstrate how a custom scalar type can be defined.

### Date as a scalar

The goal is to define a `Date` data type for returning `Date` values from the database. Let's say we're using a MongoDB driver that uses the native JavaScript `Date` data type. The `Date` data type can be easily serialized as a number using the [`getTime()` method](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/getTime). Therefore, we would like our GraphQL server to send and receive `Date`s as numbers when serializing to JSON. This number will be resolved to a `Date` on the server representing the date value. On the client, the user can simply create a new date from the received numeric value.

The following is the implementation of the `Date` data type. First, the schema:

```js
scalar Date

type MyType {
   created: Date
}
```

Next, the resolver:

```js
import { Kind, GraphQLScalarType } from 'graphql';

const resolverMap = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value); // value from the client
    },
    serialize(value) {
      return value.getTime(); // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(+ast.value); // ast value is always in string format
      }
      return null;
    },
  }),
};
```

### Validations

In this example, we follow the [official GraphQL documentation](http://graphql.org/docs/api-reference-type-system/) for the scalar datatype. Let's say that you have a database field that should only contain odd numbers. First, the schema:

```js
scalar Odd

type MyType {
    oddValue: Odd
}
```

Next, the resolver:

```js
import { Kind, GraphQLScalarType } from 'graphql';

function oddValue(value) {
  return value % 2 === 1 ? value : null;
}

const resolverMap = {
  Odd: new GraphQLScalarType({
    name: 'Odd',
    description: 'Odd custom scalar type',
    parseValue: oddValue,
    serialize: oddValue,
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return oddValue(parseInt(ast.value, 10));
      }
      return null;
    },
  }),
};
```

## Enums

An Enum is similar to a scalar type, but it can only be one of several values defined in the schema. Enums are most useful in a situation where you need the user to pick from a prescribed list of options, and they will auto-complete in tools like GraphiQL.

In the schema language, an enum looks like this:

```graphql
enum AllowedColor {
  RED
  GREEN
  BLUE
}
```

You can use it in your schema anywhere you could use a scalar:

```graphql
type Query {
  favoriteColor: AllowedColor # As a return value
  avatar(borderColor: AllowedColor): String # As an argument
}
```

Then, you query it like this:

```graphql
query {
  avatar(borderColor: RED)
}
```

If you want to pass the enum value as a variable, use a string in your JSON, like so:

```graphql
query MyAvatar($color: AllowedColor) {
  avatar(borderColor: $color)
}
```

```js
{
  "color": "RED"
}
```

Putting it all together:

```js
import { makeExecutableSchema } from '@graphql-tools/schema';

const typeDefs = `
  enum AllowedColor {
    RED
    GREEN
    BLUE
  }

  type Query {
    favoriteColor: AllowedColor # As a return value
    avatar(borderColor: AllowedColor): String # As an argument
  }
`;

const resolvers = {
  Query: {
    favoriteColor: () => 'RED',
    avatar: (root, args) => {
      // args.borderColor is 'RED', 'GREEN', or 'BLUE'
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });
```

### Internal values

Often, you might have a different value for the enum in your code than in the public API. So maybe in the API we call it `RED`, but inside our resolvers we want to use `#f00` instead. That's why you can use the `resolvers` argument to `makeExecutableSchema` to add custom values to your enum that only show up internally:

```js
const resolvers = {
  AllowedColor: {
    RED: '#f00',
    GREEN: '#0f0',
    BLUE: '#00f',
  },
};
```

These don't change the public API at all, but they do allow you to use that value instead of the schema value in your resolvers, like so:

```js
const resolvers = {
  AllowedColor: {
    RED: '#f00',
    GREEN: '#0f0',
    BLUE: '#00f',
  },
  Query: {
    favoriteColor: () => '#f00',
    avatar: (root, args) => {
      // args.favoriteColor is '#f00', '#0f0', or '#00f'
    },
  },
};
```

Most of the time, you don't need to use this feature of enums unless you're interoperating with some other library which already expects its values in a different form.
