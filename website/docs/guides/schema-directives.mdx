---
id: schema-directives
title: Schema directives
description: Using and implementing custom directives to transform schema types, fields, and arguments
---

A _directive_ is an identifier preceded by a `@` character, optionally followed by a list of named arguments, which can appear after almost any form of syntax in the GraphQL query or schema languages. Here's an example from the [GraphQL draft specification](http://facebook.github.io/graphql/draft/#sec-Type-System.Directives) that illustrates several of these possibilities:

```typescript
directive @deprecated(
  reason: String = "No longer supported"
) on FIELD_DEFINITION | ENUM_VALUE

type ExampleType {
  newField: String
  oldField: String @deprecated(reason: "Use `newField`.")
}
```

As you can see, the usage of `@deprecated(reason: ...)` _follows_ the field that it pertains to (`oldField`), though the syntax might remind you of "decorators" in other languages, which usually appear on the line above. Directives are typically _declared_ once, using the `directive @deprecated ... on ...` syntax, and then _used_ zero or more times throughout the schema document, using the `@deprecated(reason: ...)` syntax.

The possible applications of directive syntax are numerous: enforcing access permissions, formatting date strings, auto-generating resolver functions for a particular backend API, marking strings for internationalization, synthesizing globally unique object identifiers, specifying caching behavior, skipping or including or deprecating fields, and just about anything else you can imagine.

This document focuses on directives that appear in GraphQL _schemas_ (as opposed to queries) written in [Schema Definition Language](https://github.com/facebook/graphql/pull/90), or SDL for short. In the following sections, you will see how custom directives can be implemented and used to modify the structure and behavior of a GraphQL schema in ways that would not be possible using SDL syntax alone.

## Using schema directives

Most of this document is concerned with _implementing_ schema directives, and some of the examples may seem quite complicated. No matter how many tools and best practices you have at your disposal, it can be difficult to implement a non-trivial schema directive in a reliable, reusable way. Exhaustive testing is essential, and using a typed language like TypeScript is recommended, because there are so many different schema types to worry about.

However, the API we provide for _using_ a schema directive is extremely simple. Just import the implementation of the directive, then pass it to `makeExecutableSchema` via the `schemaTransforms` argument, which is an array of schema transformation functions:

```js
import { makeExecutableSchema } from '@graphql-tools/schema';
import { renameDirective } from 'fake-rename-directive-package';

const typeDefs = `
type Person @rename(to: "Human") {
  name: String!
  currentDateMinusDateOfBirth: Int @rename(to: "age")
}`;

const schema = makeExecutableSchema({
  typeDefs,
  schemaTransforms: [renameDirective('rename')],
});
```

That's it. The implementation of `renameDirective` takes care of everything else. If you understand what the directive is supposed to do to your schema, then you do not have to worry about how it works.

Everything you read below addresses some aspect of how a directive like `@rename(to: ...)` could be implemented. If that's not something you care about right now, feel free to skip the rest of this document. When you need it, it will be here.

## Implementing schema directives

Since the GraphQL specification does not discuss any specific implementation strategy for directives, it's up to each GraphQL server framework to expose an API for implementing new directives.

GraphQL Tools provides convenient yet powerful tools for implementing directive syntax: the [`mapSchema`](https://github.com/ardatan/graphql-tools/blob/master/packages/utils/src/mapSchema.ts) and [`getDirectives`](https://github.com/ardatan/graphql-tools/blob/schemaTransforms/packages/utils/src/get-directives.ts) functions. `mapSchema` takes two arguments: the original schema, and an object map -- pardon the pun -- of functions that can be used to transform each GraphQL object within the original schema. `mapSchema` is a powerful tool, in that it creates a new copy of the original schema, transforms GraphQL objects as specified, and then rewires the entire schema such that all GraphQL objects that refer to other GraphQL objects correctly point to the new set. The `getDirectives` function is straightforward; it extracts any directives (with their arguments) from the SDL originally used to create any GraphQL object.

Here is one possible implementation of the `@deprecated` directive we saw above:

```typescript
import { mapSchema, getDirectives } from '@graphql-tools/utils';
import { GraphQLSchema } from 'graphql';

export function deprecatedDirective(directiveName: string) {
  return {
    deprecatedDirectiveTypeDefs: `directive @${directiveName}(reason: String) on FIELD_DEFINITION | ENUM_VALUE`,
    deprecatedDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: fieldConfig => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            fieldConfig.deprecationReason = directiveArgumentMap.reason;
            return fieldConfig;
          }
        },
        [MapperKind.ENUM_VALUE]: enumValueConfig => {
          const directives = getDirectives(schema, enumValueConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            enumValueConfig.deprecationReason = directiveArgumentMap.reason;
            return enumValueConfig;
          }
        },
      }),
  };
}
```

In order to apply this implementation to a schema that contains `@deprecated` directives, simply pass the necessary typeDefs and schema transformation function to the `makeExecutableSchema` function in the appropriate positions:

```typescript
import { deprecatedDirective } from 'fake-deprecated-directive-package';
import { makeExecutableSchema } from '@graphql-tools/schema';

const { deprecatedDirectiveTypeDefs, deprecatedDirectiveTransformer } = deprecatedDirective('deprecated');

const schema = makeExecutableSchema({
  typeDefs: [
    deprecatedDirectiveTypeDefs,
    `
    type ExampleType {
      newField: String
      oldField: String @deprecated(reason: "Use \`newField\`.")
    }

    type Query {
      rootField: ExampleType
    }
  `,
  ],
  schemaTransforms: [deprecatedDirectiveTransformer],
});
```

Alternatively, if you want to modify an existing schema object, you can use the function interface directly:

```typescript
const schemaTransform = deprecatedDirective('deprecated');
const newSchema = schemaTransform(originalSchema);
```

We suggest that creators of directive-based schema modification functions allow users to customize the names of the relevant directives, to help users avoid collision of directive names with existing directives within their schema or other external schema modification functions. Of course, you could hard-code the name of the directive into the function, further simplifying the above examples.

## Examples

To appreciate the range of possibilities enabled by `mapSchema`, let's examine a variety of practical examples.

### Uppercasing strings

Suppose you want to ensure a string-valued field is converted to uppercase. Though this use case is simple, it's a good example of a directive implementation that works by wrapping a field's `resolve` function:

```js
function upperDirective(directiveName: string) {
  return {
    upperDirectiveTypeDefs: `directive @${directiveName} on FIELD_DEFINITION`,
    upperDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const directives = getDirectives(schema, fieldConfig);
        if (directives[directiveName]) {
          const { resolve = defaultFieldResolver } = fieldConfig;
          fieldConfig.resolve = async function (source, args, context, info) {
            const result = await resolve(source, args, context, info);
            if (typeof result === 'string') {
              return result.toUpperCase();
            }
            return result;
          }
          return fieldConfig;
        }
      }
    })
  };
}

const { upperDirectiveTypeDefs, upperDirectiveTransformer } = upperDirective('upper');
const { upperDirectiveTypeDefs: upperCaseDirectiveTypeDefs, upperDirectiveTransformer:upperCaseDirectiveTransformer } = upperDirective('upperCase');

const schema = makeExecutableSchema({
  typeDefs: [upperDirectiveTypeDefs, upperCaseDirectiveTypeDefs, `
    type Query {
      hello: String @upper
      hello2: String @upperCase
    }
  `],
  resolvers: {
    Query: {
      hello() {
        return 'hello world';
      },
      hello2() {
        return 'hello world';
      },
    },
  },
  schemaTransforms: [upperDirectiveTransformer, upperCaseDirectiveTransformer],
});
});
```

Notice how easy it is to handle both `@upper` and `@upperCase` with the same `upperDirective` implementation.

### Fetching data from a REST API

Suppose you've defined an object type that corresponds to a [REST](https://en.wikipedia.org/wiki/Representational_state_transfer) resource, and you want to avoid implementing resolver functions for every field:

```js
function restDirective(directiveName: string) {
  return {
    restDirectiveTypeDefs: `directive @${directiveName}(url: String) on FIELD_DEFINITION`;
    restDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
      [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
        const directives = getDirectives(schema, fieldConfig);
        const directiveArgumentMap = directives[directiveName];
        if (directiveArgumentMap) {
          const { url } = directiveArgumentMap;
          fieldConfig.resolve = () => fetch(url);
          return fieldConfig;
        }
      }
    },
  });
}

const { restDirectiveTypeDefs, restDirectiveTransformer } = restDirective('rest');

const schema = makeExecutableSchema({
  typeDefs: [restDirectiveTypeDefs, `
    type Query {
      people: [Person] @rest(url: "/api/v1/people")
    }
  `],
  schemaTransforms: [restDirectiveTransformer],
});
```

There are many more issues to consider when implementing a real GraphQL wrapper over a REST endpoint (such as how to do caching or pagination), but this example demonstrates the basic structure.

### Formatting date strings

Suppose your resolver returns a `Date` object but you want to return a formatted string to the client:

```js
function dateDirective(directiveName: string) {
  return {
    dateDirectiveTypeDefs: `directive @${directiveName}(format: String) on FIELD_DEFINITION`,
    dateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: fieldConfig => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            const { format } = directiveArgumentMap;
            fieldConfig.resolve = async function (source, args, context, info) {
              const date = await resolve(source, args, context, info);
              return formatDate(date, format, true);
            };
            return fieldConfig;
          }
        },
      }),
  };
}

const { dateDirectiveTypeDefs, dateDirectiveTransformer } = dateDirective('date');

const schema = makeExecutableSchema({
  typeDefs: [
    dateDirectiveTypeDefs,
    `
    scalar Date

    type Query {
      today: Date @date(format: "mmmm d, yyyy")
    }
  `,
  ],
  resolvers: {
    Query: {
      today() {
        return new Date(1519688273858).toUTCString();
      },
    },
  },
  schemaTransforms: [dateDirectiveTransformer],
});
```

Of course, it would be even better if the schema author did not have to decide on a specific `Date` format, but could instead leave that decision to the client. To make this work, the directive just needs to add an additional argument to the field:

```js
import formatDate from 'dateformat';

function formattableDateDirective(directiveName: string) {
  return {
    formattableDateDirectiveTypeDefs: `directive @${directiveName}(
        defaultFormat: String = "mmmm d, yyyy"
      ) on FIELD_DEFINITION
    `,
    formattableDateDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: fieldConfig => {
          const directives = getDirectives(schema, fieldConfig);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            const { defaultFormat } = directiveArgumentMap;

            fieldConfig.args['format'] = {
              type: GraphQLString,
            };

            fieldConfig.type = GraphQLString;
            fieldConfig.resolve = async function (source, { format, ...args }, context, info) {
              const newFormat = format || defaultFormat;
              const date = await resolve(source, args, context, info);
              return formatDate(date, newFormat, true);
            };
            return fieldConfig;
          }
        },
      }),
  };
}

const { formattableDateDirectiveTypeDefs, formattableDateDirectiveTransformer } = formattableDateDirective('date');

const schema = makeExecutableSchema({
  typeDefs: [
    formattableDateDirectiveTypeDefs,
    `
    scalar Date

    type Query {
      today: Date @date
    }
  `,
  ],
  resolvers: {
    Query: {
      today() {
        return new Date(1521131357195);
      },
    },
  },
  schemaTransforms: [formattableDateDirectiveTransformer],
});
```

Now the client can specify a desired `format` argument when requesting the `Query.today` field, or omit the argument to use the `defaultFormat` string specified in the schema:

```js
import { graphql } from 'graphql';

graphql(
  schema,
  `
    query {
      today
    }
  `
).then(result => {
  // Logs with the default "mmmm d, yyyy" format:
  console.log(result.data.today);
});

graphql(
  schema,
  `
    query {
      today(format: "d mmm yyyy")
    }
  `
).then(result => {
  // Logs with the requested "d mmm yyyy" format:
  console.log(result.data.today);
});
```

### Enforcing access permissions

Imagine a hypothetical `@auth` directive that takes an argument `requires` of type `Role`, which defaults to `ADMIN`. This `@auth` directive can appear on an `OBJECT` like `User` to set default access permissions for all `User` fields, as well as appearing on individual fields, to enforce field-specific `@auth` restrictions:

```graphql
directive @auth(requires: Role = ADMIN) on OBJECT | FIELD_DEFINITION

enum Role {
  ADMIN
  REVIEWER
  USER
  UNKNOWN
}

type User @auth(requires: USER) {
  name: String
  banned: Boolean @auth(requires: ADMIN)
  canPost: Boolean @auth(requires: REVIEWER)
}
```

```js
function authDirective(directiveName: string, getUserFn: (token: string) => { hasRole: (role: string) => boolean} ) {
  const typeDirectiveArgumentMaps: Record<string, any> = {};
  return {
    authDirectiveTypeDefs: `directive @${directiveName}(
      requires: Role = ADMIN,
    ) on OBJECT | FIELD_DEFINITION

    enum Role {
      ADMIN
      REVIEWER
      USER
      UNKNOWN
    }`,
    authDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
      [MapperKind.TYPE]: (type) => {
        const typeDirectives = getDirectives(schema, type);
        typeDirectiveArgumentMaps[type.name] = typeDirectives[directiveName];
        return undefined;
      },
      [MapperKind.OBJECT_FIELD]: (fieldConfig, _fieldName, typeName) => {
        const fieldDirectives = getDirectives(schema, fieldConfig);
        const directiveArgumentMap = fieldDirectives[directiveName] ?? typeDirectiveArgumentMaps[typeName];
        if (directiveArgumentMap) {
          const { requires } = directiveArgumentMap;
          if (requires) {
            const { resolve = defaultFieldResolver } = fieldConfig;
            fieldConfig.resolve = function (source, args, context, info) {
              const user = getUserFn(context.headers.authToken);
              if (!user.hasRole(requires)) {
                throw new Error('not authorized');
              }
              return resolve(source, args, context, info);
            }
            return fieldConfig;
          }
        }
      }
    })
  };
};

function getUser(token: string) {
  const roles = ['UNKNOWN', 'USER', 'REVIEWER', 'ADMIN'];
  return {
    hasRole: (role: string) => {
      const tokenIndex = roles.indexOf(token);
      const roleIndex = roles.indexOf(role);
      return roleIndex >= 0 && tokenIndex >= roleIndex;
    },
  };
}

const { authDirectiveTypeDefs, authDirectiveTransformer } = authDirective('auth', getUser);

const schema = makeExecutableSchema({
  typeDefs: [authDirectiveTypeDefs, `
    type User @auth(requires: USER) {
      name: String
      banned: Boolean @auth(requires: ADMIN)
      canPost: Boolean @auth(requires: REVIEWER)
    }

    type Query {
      users: [User]
    }
  `],
  resolvers: {
    Query: {
      users() {
        return [
          {
            banned: true,
            canPost: false,
            name: 'Ben',
          },
        ];
      },
    },
  },
  schemaTransforms: [authDirectiveTransformer],
});
});
```

One drawback of this approach is that it does not guarantee fields will be wrapped if they are added to the schema after `AuthDirective` is applied, and the whole `getUser(context.headers.authToken)` is a made-up API that would need to be fleshed out. In other words, we’ve glossed over some of the details that would be required for a production-ready implementation of this directive, though we hope the basic structure shown here inspires you to find clever solutions to the remaining problems.

### Enforcing value restrictions

Suppose you want to enforce a maximum length for a string-valued field:

```js
function lengthDirective(directiveName: string) {
  class LimitedLengthType extends GraphQLScalarType {
    constructor(type: GraphQLScalarType, maxLength: number) {
      super({
        name: `${type.name}WithLengthAtMost${maxLength.toString()}`,

        serialize(value: string) {
          const newValue: string = type.serialize(value);
          expect(typeof newValue.length).toBe('number');
          if (newValue.length > maxLength) {
            throw new Error(
              `expected ${newValue.length.toString(
                10,
              )} to be at most ${maxLength.toString(10)}`,
            );
          }
          return newValue;
        },

        parseValue(value: string) {
          return type.parseValue(value);
        },

        parseLiteral(ast: StringValueNode) {
          return type.parseLiteral(ast, {});
        },
      });
    }
  }

  const limitedLengthTypes: Record<string, Record<number, GraphQLScalarType>> = {};

  function getLimitedLengthType(type: GraphQLScalarType, maxLength: number): GraphQLScalarType {
    const limitedLengthTypesByTypeName = limitedLengthTypes[type.name]
    if (!limitedLengthTypesByTypeName) {
      const newType = new LimitedLengthType(type, maxLength);
      limitedLengthTypes[type.name] = {}
      limitedLengthTypes[type.name][maxLength] = newType;
      return newType;
    }

    const limitedLengthType = limitedLengthTypesByTypeName[maxLength];
    if (!limitedLengthType) {
      const newType = new LimitedLengthType(type, maxLength);
      limitedLengthTypesByTypeName[maxLength] = newType;
      return newType;
    }

    return limitedLengthType;
  }

  function wrapType<F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig>(fieldConfig: F, directiveArgumentMap: Record<string, any>): void {
    if (isNonNullType(fieldConfig.type) && isScalarType(fieldConfig.type.ofType)) {
      fieldConfig.type = getLimitedLengthType(fieldConfig.type.ofType, directiveArgumentMap.max);
    } else if (isScalarType(fieldConfig.type)) {
      fieldConfig.type = getLimitedLengthType(fieldConfig.type, directiveArgumentMap.max);
    } else {
      throw new Error(`Not a scalar type: ${fieldConfig.type.toString()}`);
    }
  }

  return {
    lengthDirectiveTypeDefs: `directive @${directiveName}(max: Int) on FIELD_DEFINITION | INPUT_FIELD_DEFINITION`,
    lengthDirectiveTransformer: (schema: GraphQLSchema) => mapSchema(schema, {
      [MapperKind.FIELD]: (fieldConfig) => {
        const directives = getDirectives(schema, fieldConfig);
        const directiveArgumentMap = directives[directiveName];
        if (directiveArgumentMap) {
          wrapType(fieldConfig, directiveArgumentMap);
          return fieldConfig;
        }
      }
    }),
  };
};

const { lengthDirectiveTypeDefs, lengthDirectiveTransformer } = lengthDirective('length');

const schema = makeExecutableSchema({
  typeDefs: [lengthDirectiveTypeDefs, `
    type Query {
      books: [Book]
    }

    type Book {
      title: String @length(max: 10)
    }

    type Mutation {
      createBook(book: BookInput): Book
    }

    input BookInput {
      title: String! @length(max: 10)
    }`]
  ,
  resolvers: {
    Query: {
      books() {
        return [
          {
            title: 'abcdefghijklmnopqrstuvwxyz',
          },
        ];
      },
    },
    Mutation: {
      createBook(_parent, args) {
        return args.book;
      },
    },
  },
  schemaTransforms: [lengthDirectiveTransformer],
});
```

Note that new types can be added to the schema with ease, but that each type must be uniquely named.

### Synthesizing unique IDs

Suppose your database uses incrementing IDs for each resource type, so IDs are not unique across all resource types. Here’s how you might synthesize a field called `uid` that combines the object type with various field values to produce an ID that’s unique across your schema:

```js
import { GraphQLID } from 'graphql';
import { createHash } from 'crypto';

function uniqueIDDirective(directiveName: string) {
  return {
    uniqueIDDirectiveTypeDefs: `directive @${directiveName}(name: String, from: [String]) on OBJECT`,
    uniqueIDDirectiveTransformer: (schema: GraphQLSchema) =>
      mapSchema(schema, {
        [MapperKind.OBJECT_TYPE]: type => {
          const directives = getDirectives(schema, type);
          const directiveArgumentMap = directives[directiveName];
          if (directiveArgumentMap) {
            const { name, from } = directiveArgumentMap;
            const config = type.toConfig();
            config.fields[name] = {
              type: GraphQLID,
              description: 'Unique ID',
              args: {},
              resolve(object: any) {
                const hash = createHash('sha1');
                hash.update(type.name);
                from.forEach((fieldName: string) => {
                  hash.update(String(object[fieldName]));
                });
                return hash.digest('hex');
              },
            };
            return new GraphQLObjectType(config);
          }
        },
      }),
  };
}

const { uniqueIDDirectiveTypeDefs, uniqueIDDirectiveTransformer } = uniqueIDDirective('uniqueID');

const schema = makeExecutableSchema({
  typeDefs: [
    uniqueIDDirectiveTypeDefs,
    `
    type Query {
      people: [Person]
      locations: [Location]
    }

    type Person @uniqueID(name: "uid", from: ["personID"]) {
      personID: Int
      name: String
    }

    type Location @uniqueID(name: "uid", from: ["locationID"]) {
      locationID: Int
      address: String
    }
  `,
  ],
  resolvers: {
    Query: {
      people() {
        return [
          {
            personID: 1,
            name: 'Ben',
          },
        ];
      },
      locations() {
        return [
          {
            locationID: 1,
            address: '140 10th St',
          },
        ];
      },
    },
  },
  schemaTransforms: [uniqueIDDirectiveTransformer],
});
```

## Declaring schema directives

SDL syntax requires declaring the names, argument types, default argument values, and permissible locations of any available directives. We have shown one approach above to doing so. If you're implementing a reusable directive for public consumption, you will probably want to either guide your users as to how properly declare their directives, or export the required SDL syntax as above so that users can pass it to `makeExecutableSchema`. These techniques can be used in combination, i.e. you may wish to export the directive syntax and provide instructions on how to structure any dependent types. Take a second look at the auth example above to see how this may be done and note the interplay between the directive definition and the `Role` type.

## What about query directives?

Directive syntax can also appear in GraphQL queries sent from the client. Query directive implementation can be performed within graphql resolver using similar techniques as the above. In general, however, schema authors should consider using field arguments wherever possible instead of query directives, with query directives most useful for annotating the query with metadata affecting the execution algorithm itself, e.g. [`defer`, `stream`](https://github.com/graphql/graphql-spec/blob/master/rfcs/DeferStream.md), etc.

In theory, access to the query directives is available within the `info` resolver argument by iterating through each `fieldNode` of `info.fieldNodes`, although, as above, use of query directives within standard resolvers is not necessarily recommended.

## What about `directiveResolvers`?

The `makeExecutableSchema` function also takes a `directiveResolvers` option that can be used for implementing certain kinds of `@directive`s on fields that have resolver functions.

The new abstraction is more general, since it can visit any kind of schema syntax, and do much more than just wrap resolver functions. However, the old `directiveResolvers` API has been left in place for backwards compatibility, though it is now implemented in terms of `mapSchema`:

```typescript
export function attachDirectiveResolvers(
  schema: GraphQLSchema,
  directiveResolvers: IDirectiveResolvers
): GraphQLSchema {
  // ... argument validation ...

  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: fieldConfig => {
      const newFieldConfig = { ...fieldConfig };

      const directives = getDirectives(schema, fieldConfig);
      Object.keys(directives).forEach(directiveName => {
        if (directiveResolvers[directiveName]) {
          const resolver = directiveResolvers[directiveName];
          const originalResolver = newFieldConfig.resolve != null ? newFieldConfig.resolve : defaultFieldResolver;
          const directiveArgs = directives[directiveName];
          newFieldConfig.resolve = (source, originalArgs, context, info) => {
            return resolver(
              () =>
                new Promise((resolve, reject) => {
                  const result = originalResolver(source, originalArgs, context, info);
                  if (result instanceof Error) {
                    reject(result);
                  }
                  resolve(result);
                }),
              source,
              directiveArgs,
              context,
              info
            );
          };
        }
      });

      return newFieldConfig;
    },
  });
}
```

Existing code that uses `directiveResolvers` could consider migrating to direct usage of `mapSchema`, though we have no immediate plans to deprecate `directiveResolvers`.

## What about code-first schemas?

You can use schema transformation functions with code-first schemas as well. By default, if a `directives` key exists within the `extensions` field for a given GraphQL entity, the `getDirectives` function will retrieve the directive data from the GraphQL entity's `extensions.directives` data rather than from the SDL. This, of course, allows schemas created without SDL to use any schema transformation functions created for directive use, as long as they define the necessary data within the GraphQL entity extensions.

This behavior can be customized! The `getDirectives` function takes a third argument, `pathToDirectivesInExtensions`, an array of strings, that allows customization of this path to directive data within extensions, which is set to `['directives']` by default. We recommend allowing end users to customize this path similar to how the directive name can be customized above.

See [this `graphql-js` issue](https://github.com/graphql/graphql-js/issues/1343) for more information on directives with code-first schemas. We follow the [Gatsby and graphql-compose convention](https://github.com/graphql/graphql-js/issues/1343#issuecomment-479877640) of reading directives from the `extensions` field, but allow customization as above.

## Full mapSchema API

How can you customize schema mapping? The second argument provided to mapSchema is an object of type `SchemaMapper` that can specify individual mapping functions.

GraphQL objects are mapped according to the following algorithm:

1. Types are mapped. The most general matching mapping function available will be used, i.e. inclusion of a `MapperKind.TYPE` will cause all types to be mapped with the specified mapper. Specifying `MapperKind.ABSTRACT_TYPE` and `MapperKind.MAPPER.QUERY` mappers will cause the first mapper to be used for interfaces and unions, the latter to be used for the root query object type, and all other types to be ignored.
2. Enum values are mapped. If all you want to do to an enum is to change one value, it is more convenient to use a `MapperKind.ENUM_VALUE` mapper than to iterate through all values on your own and recreate the type -- although that would work!
3. Fields are mapped. Similar to above, if you want to modify a single field, `mapSchema` can do the iteration for you. You can subspecify `MapperKind.OBJECT_FIELD` or `MapperKind.ROOT_FIELD` to select a limited subset of fields to map.
4. Arguments are mapped. Similar to above, you can subspecify `MapperKind.ARGUMENT` if you want to modify only an argument. `mapSchema` can iterate through the types and fields for you.
5. Directives are mapped if `MapperKind.DIRECTIVE` is specified.

```typescript
export interface SchemaMapper {
  [MapperKind.TYPE]?: NamedTypeMapper;
  [MapperKind.SCALAR_TYPE]?: ScalarTypeMapper;
  [MapperKind.ENUM_TYPE]?: EnumTypeMapper;
  [MapperKind.COMPOSITE_TYPE]?: CompositeTypeMapper;
  [MapperKind.OBJECT_TYPE]?: ObjectTypeMapper;
  [MapperKind.INPUT_OBJECT_TYPE]?: InputObjectTypeMapper;
  [MapperKind.ABSTRACT_TYPE]?: AbstractTypeMapper;
  [MapperKind.UNION_TYPE]?: UnionTypeMapper;
  [MapperKind.INTERFACE_TYPE]?: InterfaceTypeMapper;
  [MapperKind.ROOT_OBJECT]?: ObjectTypeMapper;
  [MapperKind.QUERY]?: ObjectTypeMapper;
  [MapperKind.MUTATION]?: ObjectTypeMapper;
  [MapperKind.SUBSCRIPTION]?: ObjectTypeMapper;
  [MapperKind.ENUM_VALUE]?: EnumValueMapper;
  [MapperKind.FIELD]?: GenericFieldMapper<GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig>;
  [MapperKind.OBJECT_FIELD]?: FieldMapper;
  [MapperKind.ROOT_FIELD]?: FieldMapper;
  [MapperKind.QUERY_ROOT_FIELD]?: FieldMapper;
  [MapperKind.MUTATION_ROOT_FIELD]?: FieldMapper;
  [MapperKind.SUBSCRIPTION_ROOT_FIELD]?: FieldMapper;
  [MapperKind.INTERFACE_FIELD]?: FieldMapper;
  [MapperKind.COMPOSITE_FIELD]?: FieldMapper;
  [MapperKind.INPUT_OBJECT_FIELD]?: InputFieldMapper;
  [MapperKind.ARGUMENT]?: ArgumentMapper;
  [MapperKind.DIRECTIVE]?: DirectiveMapper;
}

export type NamedTypeMapper = (type: GraphQLNamedType, schema: GraphQLSchema) => GraphQLNamedType | null | undefined;

export type ScalarTypeMapper = (type: GraphQLScalarType, schema: GraphQLSchema) => GraphQLScalarType | null | undefined;

export type EnumTypeMapper = (type: GraphQLEnumType, schema: GraphQLSchema) => GraphQLEnumType | null | undefined;

export type EnumValueMapper = (
  value: GraphQLEnumValueConfig,
  typeName: string,
  schema: GraphQLSchema
) => GraphQLEnumValueConfig | [string, GraphQLEnumValueConfig] | null | undefined;

export type CompositeTypeMapper = (
  type: GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType,
  schema: GraphQLSchema
) => GraphQLObjectType | GraphQLInterfaceType | GraphQLUnionType | null | undefined;

export type ObjectTypeMapper = (type: GraphQLObjectType, schema: GraphQLSchema) => GraphQLObjectType | null | undefined;

export type InputObjectTypeMapper = (
  type: GraphQLInputObjectType,
  schema: GraphQLSchema
) => GraphQLInputObjectType | null | undefined;

export type AbstractTypeMapper = (
  type: GraphQLInterfaceType | GraphQLUnionType,
  schema: GraphQLSchema
) => GraphQLInterfaceType | GraphQLUnionType | null | undefined;

export type UnionTypeMapper = (type: GraphQLUnionType, schema: GraphQLSchema) => GraphQLUnionType | null | undefined;

export type InterfaceTypeMapper = (
  type: GraphQLInterfaceType,
  schema: GraphQLSchema
) => GraphQLInterfaceType | null | undefined;

export type DirectiveMapper = (
  directive: GraphQLDirective,
  schema: GraphQLSchema
) => GraphQLDirective | null | undefined;

export type GenericFieldMapper<F extends GraphQLFieldConfig<any, any> | GraphQLInputFieldConfig> = (
  fieldConfig: F,
  fieldName: string,
  typeName: string,
  schema: GraphQLSchema
) => F | [string, F] | null | undefined;

export type FieldMapper = GenericFieldMapper<GraphQLFieldConfig<any, any>>;

export type ArgumentMapper = (
  argumentConfig: GraphQLArgumentConfig,
  fieldName: string,
  typeName: string,
  schema: GraphQLSchema
) => GraphQLArgumentConfig | [string, GraphQLArgumentConfig] | null | undefined;

export type InputFieldMapper = GenericFieldMapper<GraphQLInputFieldConfig>;
```
