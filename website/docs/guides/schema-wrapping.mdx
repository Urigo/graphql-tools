---
id: schema-wrapping
title: Schema wrapping
description: Wrap schemas to automatically modify schemas, requests and results
---

Schema wrapping (`@graphql-tools/wrap`) creates a modified version of a schema that proxies, or "wraps", the original unmodified schema. This technique is particularly useful when the original schema _cannot_ be changed, such as with [remote schemas](/docs/remote-schemas/).

Schema wrapping works by creating a new "gateway" schema that simply delegates all operations to the original subschema. A series of _transforms_ are applied that may modify the shape of the gateway schema and all proxied operations; these operational transforms may modify an operation prior to delegation, or modify the subschema result prior to its return.

Note that [schema stitching](/docs/stitch-combining-schemas) is a _superset_ of the wrapping API. If you want to combine multiple services (with optional transforms) into one combined gateway schema, then you should use the [stitchSchemas](/docs/stitch-combining-schemas) method directly and allow it to handle all of the subservice wrappings.

## Getting started

Let's consider changing the name of a type in a simple schema. In this example, we'd like to replace all instances of type `Widget` with `NewWidget`.

```graphql
# original subschema
type Widget {
  id: ID!
  name: String
}

type Query {
  widget: Widget
}

# wrapping gateway schema
type NewWidget {
  id: ID!
  name: String
}

type Query {
  widget: NewWidget
}
```

Upon delegation to the original subschema, we want the `NewWidget` type to be mapped to the underlying `Widget` type. At first glance, it might seem as though most queries will work the same as before:

```graphql
query {
  widget {
    id
    name
  }
}
```

Since the fields of the type have not changed, delegating to the original subschema is relatively easy here. However, the new name begins to matter when fragments and variables are used:

```graphql
query {
  widget {
    id
    ... on NewWidget {
      name
    }
  }
}
```

Since the `NewWidget` type does not exist in the original subschema, this fragment will not match anything there and gets filtered out during delegation. This problem is solved by operational transforms:

- **transformRequest**: a function that renames occurrences of `NewWidget -> Widget` before delegating to the original subschema.
- **transformResult**: a function that conversely renames returned `__typename` fields `Widget -> NewWidget` in the final result.

Conveniently, this task of renaming types is very common and there's a built-in transform available for it. Using the built-in transform with a call to `wrapSchema` gets the job done:

```js
const { wrapSchema, RenameTypes } = require('@graphql-tools/wrap');

const typeNameMap = {
  Widget: 'NewWidget',
};

const schema = wrapSchema({
  schema: originalSchema,
  transforms: [new RenameTypes(name => typeNameMap[name] || name)],
});
```

## Built-in transforms

These are ready-made classes implementing the `Transform` interface. They are intended to cover many common use cases, and they may also serve as examples of how to implement your own [custom transforms](#custom-transforms).

### Filtering

Filter transforms are constructed with a filter function that returns a boolean. The transform executes the filter on each schema element within its scope, and rejects elements that do not pass the filter.

- [`FilterTypes`](/docs/api/classes/wrap_src.filtertypes): filters all element types.
- [`FilterRootFields`](/docs/api/classes/wrap_src.filterrootfields): filters fields on the root Query, Mutation, and Subscription objects.
- [`FilterObjectFields`](/docs/api/classes/wrap_src.filterobjectfields): filters fields of Object types.
- [`FilterObjectFieldDirectives`](/docs/api/classes/wrap_src.filterobjectfielddirectives): filters Object field directives.
- [`FilterInterfaceFields`](/docs/api/classes/wrap_src.filterinterfacefields): filters fields of Interface types.
- [`FilterInputObjectFields`](/docs/api/classes/wrap_src.filterinputobjectfields): filters input fields of InputObject types.

```js
const {
  wrapSchema,
  FilterTypes,
  FilterRootFields,
  FilterObjectFields,
  FilterObjectFieldDirective,
  FilterInterfaceFields,
  FilterInputObjectFields,
} = require('@graphql-tools/wrap');

const schema = wrapSchema({
  schema: originalSchema,
  transforms: [
    new FilterTypes(type => true),
    new FilterRootFields((operationName, fieldName, fieldConfig) => true),
    new FilterObjectFields((typeName, fieldName, fieldConfig) => true),
    new FilterObjectFieldDirectives((directiveName, directiveValue) => true),
    new FilterInterfaceFields((typeName, fieldName, fieldConfig) => true),
    new FilterInputObjectFields((typeName, fieldName, inputFieldConfig) => true),
  ],
});
```

### Renaming

Renaming transforms are constructed with a renamer function that returns a string. The transform executes the renamer on each schema element within its scope, and applies the revised names to gateway schema elements. If a renamer returns `undefined`, the name will be left unchanged. Additional options may control whether built-in types and scalars are renamed, see linked API docs.

- [`RenameTypes`](/docs/api/classes/wrap_src.renametypes): renames all element types.
- [`RenameRootTypes`](/docs/api/classes/wrap_src.renameroottypes): renames the root Query, Mutation, and Subscription types.
- [`RenameRootFields`](/docs/api/classes/wrap_src.renamerootfields): renames fields on the root Query, Mutation, and Subscription objects.
- [`RenameObjectFields`](/docs/api/classes/wrap_src.renameobjectfields): renames fields of Object types.
- [`RenameInterfaceFields`](/docs/api/classes/wrap_src.renameinterfacefields): renames fields of Interface types.
- [`RenameInputObjectFields`](/docs/api/classes/wrap_src.renameinputobjectfields): renames input fields of InputObject types.

```js
const {
  wrapSchema,
  RenameTypes,
  RenameRootTypes,
  RenameRootFields,
  RenameObjectFields,
  RenameInterfaceFields,
  RenameInputObjectFields,
} = require('@graphql-tools/wrap');

const schema = wrapSchema({
  schema: originalSchema,
  transforms: [
    new RenameTypes(name => `New${name}`),
    new RenameRootTypes(name => `New${name}`),
    new RenameRootFields((operationName, fieldName, fieldConfig) => `new_${fieldName}`),
    new RenameObjectFields((typeName, fieldName, fieldConfig) => `new_${fieldName}`),
    new RenameInterfaceFields((typeName, fieldName, fieldConfig) => `new_${fieldName}`),
    new RenameInputObjectFields((typeName, fieldName, inputFieldConfig) => `new_${fieldName}`),
  ],
});
```

### Modifying

Modifying transforms allow element names and their definitions to be modified or omitted. They may filter, rename, and make other freeform modifications all at once. These transforms accept element transformer functions that may return one of several outcomes:

1. A modified version of the element config.
2. An array with a modified field name and new element config.
3. `null` to omit the element from the schema.
4. `undefined` to leave the element unchanged.

Available transforms include:

- [`TransformRootFields`](/docs/api/classes/wrap_src.transformrootfields): redefines fields on the root Query, Mutation, and Subscription objects.
- [`TransformObjectFields`](/docs/api/classes/wrap_src.transformobjectfields): redefines fields of Object types.
- [`TransformInterfaceFields`](/docs/api/classes/wrap_src.transforminterfacefields): redefines fields of Interface types.
- [`TransformCompositeFields`](/docs/api/classes/wrap_src.transformcompositefields): redefines composite fields.
- [`TransformInputObjectFields`](/docs/api/classes/wrap_src.transforminputobjectfields): redefines fields of InputObject types.
- [`TransformEnumValues`](/docs/api/classes/wrap_src.transformenumvalues): redefines values of Enum types.

```js
const {
  wrapSchema,
  TransformRootFields,
  TransformObjectFields,
  TransformInterfaceFields,
  TransformCompositeFields,
  TransformInputObjectFields,
  TransformEnumValues,
} = require('@graphql-tools/wrap');

const schema = wrapSchema({
  schema: originalSchema,
  transforms: [
    new TransformRootFields((operationName, fieldName, fieldConfig) => fieldConfig),
    new TransformObjectFields((typeName, fieldName, fieldConfig) => [`new_${fieldName}`, fieldConfig]),
    new TransformInterfaceFields((typeName, fieldName, fieldConfig) => null),
    new TransformCompositeFields((typeName, fieldName, fieldConfig) => undefined),
    new TransformInputObjectFields((typeName, fieldName, inputFieldConfig) => [`new_${fieldName}`, inputFieldConfig]),
    new TransformEnumValues((typeName, enumValue, enumValueConfig) => [`NEW_${enumValue}`, enumValueConfig]),
  ],
});
```

These transforms accept an optional second node transformer function. When specified, the node transformer is called upon any element of the given kind in a request; transforming the result is possible by wrapping the element's resolver with the element transformer function (first argument).

### Grooming

These transforms eliminate unwanted or unnecessary elements from a schema. These are configured in a variety of ways, so consult API documentation for specific options.

- [`PruneSchema`](/docs/api/classes/wrap_src.pruneschema): eliminates unreachable elements from the schema. This is generally useful to include _after_ a filter transform so that orphaned types and values are eliminated from the schema. Accepts [pruneSchema](/docs/api/modules/utils#pruneschema) options.
- [`RemoveObjectFieldDeprecations`](/docs/api/classes/wrap_src.removeobjectfielddeprecations): accepts a string or regex describing a deprecation to remove from the gateway schema. Fields matching this deprecation will be un-deprecated. Useful for normalizing [computed fields](/docs/stitch-type-merging#computed-fields) that are activated by the gateway wrapper.
- [`RemoveObjectFieldDirectives`](/docs/api/classes/wrap_src.removeobjectfielddirectives): removes object field directives that match a directive name and optional argument criteria.
- [`RemoveObjectFieldsWithDeprecation`](/docs/api/classes/wrap_src.removeobjectfieldswithdeprecation): removes object fields whose deprecation reason matches the provided string or regex.
- [`RemoveObjectFieldsWithDirective`](/docs/api/classes/wrap_src.removeobjectfieldswithdirective): removes object fields with a schema directive matching a given name and optional argument criteria.

```js
const {
  wrapSchema,
  PruneSchema,
  RemoveObjectFieldDeprecations,
  RemoveObjectFieldDirectives,
  RemoveObjectFieldsWithDeprecation,
  RemoveObjectFieldsWithDirective,
} = require('@graphql-tools/wrap');

const schema = wrapSchema({
  schema: originalSchema,
  transforms: [
    new PruneSchema(options),
    new RemoveObjectFieldDeprecations(/^gateway access only/),
    new RemoveObjectFieldDirectives('deprecated', { reason: /^gateway access only/ }),
    new RemoveObjectFieldsWithDeprecation(/^gateway access only/),
    new RemoveObjectFieldsWithDirective('deprecated', { reason: /^gateway access only/ }),
  ],
});
```

### Operational

It may be sometimes useful to add additional transforms to manually change an operation request or result when using `delegateToSchema`. Common use cases may be move selections around or to wrap them. The following built-in transforms may be useful in those cases.

- `ExtractField({ from: Array<string>, to: Array<string> })` move selection at `from` path to `to` path.
- `WrapQuery(path: Array<string>, wrapper: QueryWrapper, extractor: (result: any) => any)` wrap a selection at `path` using function `wrapper`. Apply `extractor` at the same path to get the result. This is used to get a result nested inside other result.

```js
const {
  WrapQuery
} = require('@graphql-tools/wrap');

transforms: [
  // Wrap document takes a subtree as an AST node
  new WrapQuery(
    // path at which to apply wrapping and extracting
    ['userById'],
    (subtree: SelectionSetNode) => ({
      // we create a wrapping AST Field
      kind: Kind.FIELD,
      name: {
        kind: Kind.NAME,
        // that field is `address`
        value: 'address',
      },
      // Inside the field selection
      selectionSet: subtree,
    }),
    // how to process the data result at path
    result => result && result.address,
  ),
],
```

`WrapQuery` can also be used to expand multiple top level query fields

```ts
import { WrapQuery } from '@graphql-tools/wrap';
import { SelectionSetNode } from 'graphql';

transforms: [
  // Wrap document takes a subtree as an AST node
  new WrapQuery(
    // path at which to apply wrapping and extracting
    ['userById'],
    (subtree: SelectionSetNode) => {
      const newSelectionSet = {
        kind: Kind.SELECTION_SET,
        selections: subtree.selections.map(selection => {
          // just append fragments, not interesting for this
          // test
          if (selection.kind === Kind.INLINE_FRAGMENT ||
            selection.kind === Kind.FRAGMENT_SPREAD) {
            return selection;
          }
          // prepend `address` to name and camelCase
          const oldFieldName = selection.name.value;
          return {
            kind: Kind.FIELD,
            name: {
              kind: Kind.NAME,
              value: 'address' +
                oldFieldName.charAt(0).toUpperCase() +
                oldFieldName.slice(1)
            }
          };
        })
      };
      return newSelectionSet;
    },
    // how to process the data result at path
    result => ({
      streetAddress: result.addressStreetAddress,
      zip: result.addressZip
    })
```

## Custom transforms

Custom transforms are fairly straightforward to write. They are simply objects with up to three methods:

- `transformSchema`: receives the original subschema and applies modifications to it, returning a modified wrapper (proxy) schema. This method runs once while initially wrapping the subschema.
- `transformRequest`: receives each request made to the wrapped schema. The shape of a request matches the wrapper schema, and must be returned in a shape that matches the original subschema.
- `transformResult`: receives each result returned from the original subschema. The shape of the result matches the original subschema, and must be returned in a shape that matches the wrapper schema.

The complete transform object API is as follows:

```ts
export interface Transform<T = Record<string, any>> {
  transformSchema?: SchemaTransform;
  transformRequest?: RequestTransform<T>;
  transformResult?: ResultTransform<T>;
}

export type SchemaTransform = (
  originalWrappingSchema: GraphQLSchema,
  subschemaConfig: SubschemaConfig,
  transformedSchema?: GraphQLSchema
) => GraphQLSchema;

export type RequestTransform<T = Record<string, any>> = (
  originalRequest: Request,
  delegationContext: DelegationContext,
  transformationContext: T
) => Request;

export type ResultTransform<T = Record<string, any>> = (
  originalResult: ExecutionResult,
  delegationContext: DelegationContext,
  transformationContext: T
) => ExecutionResult;

type Request = {
  document: DocumentNode;
  variables: Record<string, any>;
  extensions?: Record<string, any>;
};
```

A simple transform that removes types, fields, and arguments prefixed by an underscore might look like this:

```js
import { wrapSchema } from '@graphql-tools/wrap';
import { filterSchema, pruneSchema } from '@graphql-tools/utils';

class RemovePrivateElementsTransform {
  transformSchema(originalWrappingSchema) {
    const isPublicName = name => !name.startsWith('_');

    return pruneSchema(
      filterSchema({
        schema: originalWrappingSchema,
        typeFilter: typeName => isPublicName(typeName),
        rootFieldFilter: (operationName, fieldName) => isPublicName(fieldName),
        fieldFilter: (typeName, fieldName) => isPublicName(fieldName),
        argumentFilter: (typeName, fieldName, argName) => isPublicName(argName),
      })
    );
  }

  // no need for operational transforms
}

const schema = wrapSchema({
  schema: myRemoteSchema,
  transforms: [new RemovePrivateElementsTransform()],
});
```

## Subschema delegation

The `wrapSchema` method will produce a new schema with all queued `transformSchema` methods applied. Delegating resolvers are automatically generated to map from new schema root fields to old schema root fields. These resolvers should be sufficient for most common case so you don't have to implement your own.

Delegating resolvers will apply all operation transforms defined by the wrapper's `Transform` objects. Each provided `transformRequest` functions will be applies in reverse order, until the request matches the original schema. The `transformResult` functions will be applied in the opposite order until the result matches the final gateway schema.

In advanced cases, transforms may wish to create additional delegating root resolvers (for example, when hoisting a field into a root type). This is also possible. The wrapping schema is actually generated twice -- the first run results in a possibly non-executable version, while the second execution also includes the result of the first one within the `transformedSchema` argument so that an executable version with any new proxying resolvers can be created.

Remote schemas can also be wrapped! In fact, this is the primary use case. See documentation regarding [remote schemas](/docs/remote-schemas/) for further details about remote schemas. Note that as explained there, when wrapping remote schemas, you will be wrapping a subschema config object, and the array of transforms should be defined on that object rather than as a second argument to `wrapSchema`.
