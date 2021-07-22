# @graphql-tools/delegate

## 8.0.0

### Major Changes

- 7d3e3006: BREAKING CHANGE
  - Remove `rootValue` from subschemaConfig
  - - Pass it through `ExecutionParams` or delegation options
  - Do not pass `info.rootValue` if `rootValue` is falsy
- dae6dc7b: refactor: ExecutionParams type replaced by Request type

  rootValue property is now a part of the Request type.

  When delegating with delegateToSchema, rootValue can be set multiple ways:

  - when using a custom executor, the custom executor can utilize a rootValue in whichever custom way it specifies.
  - when using the default executor (execute/subscribe from graphql-js):
    -- rootValue can be passed to delegateToSchema via a named option
    -- rootValue can be included within a subschemaConfig
    -- otherwise, rootValue is inferred from the originating schema

  When using wrapSchema/stitchSchemas, a subschemaConfig can specify the createProxyingResolver function which can pass whatever rootValue it wants to delegateToSchema as above.

- c42e811d: BREAKING CHANGES;

  - Rename `Request` to `ExecutionRequest`
  - Drop unnecessary `GraphQLResolveInfo` in `ExecutionRequest`
  - Add required `operationType: OperationTypeNode` field in `ExecutionRequest`
  - Add `context` in `createRequest` and `createRequestInfo` instead of `delegateToSchema`

  > It doesn't rely on info.operation.operationType to allow the user to call an operation from different root type.
  > And it doesn't call getOperationAST again and again to get operation type from the document/operation because we have it in Request and ExecutionParams
  > https://github.com/ardatan/graphql-tools/pull/3166/files#diff-d4824895ea613dcc1f710c3ac82e952fe0ca12391b671f70d9f2d90d5656fdceR38

  Improvements;

  - Memoize `defaultExecutor` for a single `GraphQLSchema` so allow `getBatchingExecutor` to memoize `batchingExecutor` correctly.
  - And there is no different `defaultExecutor` is created for `subscription` and other operation types. Only one executor is used.

  > Batch executor is memoized by `executor` reference but `createDefaultExecutor` didn't memoize the default executor so this memoization wasn't working correctly on `batch-execute` side.
  > https://github.com/ardatan/graphql-tools/blob/remove-info-executor/packages/batch-execute/src/getBatchingExecutor.ts#L9

- 7d3e3006: BREAKING CHANGE
  - Now it uses the native [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError) implementation. The major difference is the individual errors are kept under `errors` property instead of the object itself with `Symbol.iterator`.
  ```js
  // From;
  for (const error of aggregateError)
  // To;
  for (const error of aggregateError.errors)
  ```
- aa43054d: BREAKING CHANGE: validations are skipped by default, use validateRequest: true to reenable
- c0ca3190: BREAKING CHANGE
  - Remove Subscriber and use only Executor
  - - Now `Executor` can receive `AsyncIterable` and subscriptions will also be handled by `Executor`. This is a future-proof change for defer, stream and live queries

### Patch Changes

- Updated dependencies [af9a78de]
- Updated dependencies [9c26b847]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [dae6dc7b]
- Updated dependencies [6877b913]
- Updated dependencies [7d3e3006]
- Updated dependencies [c42e811d]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [74581cf3]
- Updated dependencies [c0ca3190]
- Updated dependencies [7d3e3006]
- Updated dependencies [982c8f53]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
  - @graphql-tools/utils@8.0.0
  - @graphql-tools/schema@8.0.0
  - @graphql-tools/batch-execute@8.0.0

## 7.1.5

### Patch Changes

- 22a9f3da: fix(deps): follow package conventions on when to pin
- Updated dependencies [22a9f3da]
  - @graphql-tools/batch-execute@7.1.2
  - @graphql-tools/schema@7.1.5

## 7.1.4

### Patch Changes

- 61da3e82: use value-or-promise to streamline working with sync values or async promises
- Updated dependencies [61da3e82]
  - @graphql-tools/batch-execute@7.1.1
  - @graphql-tools/schema@7.1.4

## 7.1.3

### Patch Changes

- b202587b: fix(delegate): handle executor errors

## 7.1.2

### Patch Changes

- 6aed1714: Allows `MergedTypeConfig` to be written with an `entryPoints` array for multiple merged type entry points, each with their own `fieldName` and `selectionSet`:

  ```js
  {
    schema: testSchema,
    merge: {
      Product: {
        entryPoints: [{
          selectionSet: '{ id }',
          fieldName: 'productById',
          key: ({ id, price, weight }) => ({ id, price, weight }),
          argsFromKeys: (key) => ({ key }),
        }, {
          selectionSet: '{ upc }',
          fieldName: 'productByUpc',
          key: ({ upc, price, weight }) => ({ upc, price, weight }),
          argsFromKeys: (key) => ({ key }),
        }],
      }
    }
  }
  ```

  These multiple entry points accommodate types with multiple keys across services that rely on a central service to join them, for example:

  - Catalog service: `type Product { upc }`
  - Vendors service: `type Product { upc id }`
  - Reviews service: `type Product { id }`

  Given this graph, the possible traversals require the Vendors service to provide entry points for each unique key format:

  - `Catalog > Vendors > Reviews`
  - `Catalog < Vendors > Reviews`
  - `Catalog < Vendors < Reviews`

  Is it highly recommended that you enable query batching for subschemas with multiple entry points.

## 7.1.1

### Patch Changes

- f84e7b15: fix(delegate): export executor typings not to have breaking change
- Updated dependencies [194ac370]
  - @graphql-tools/utils@7.7.1

## 7.1.0

### Minor Changes

- 58fd4b28: feat(types): add TContext to stitchSchemas and executor

### Patch Changes

- Updated dependencies [58fd4b28]
- Updated dependencies [43da6b59]
  - @graphql-tools/batch-execute@7.1.0
  - @graphql-tools/utils@7.7.0

## 7.0.10

### Patch Changes

- 24926654: Deprecates the `MergeTypeConfig.computedFields` setting (with backwards-compatible warning) in favor of new computed field configuration written as:

  ```js
  merge: {
    MyType: {
      fields: {
        myComputedField: {
          selectionSet: '{ weight }',
          computed: true,
        }
      }
    }
  }
  ```

  A field-level `selectionSet` specifies field dependencies while the `computed` setting structures the field in a way that assures it is always selected with this data provided. The `selectionSet` is intentionally generic to support possible future uses. This new pattern organizes all field-level configuration (including `canonical`) into a single structure.

## 7.0.9

### Patch Changes

- d9b82a2e: fix(delegate) fix array check
- d9b82a2e: enhance(stitch) canonical merged type and field definitions. Use the @canonical directive to promote preferred type and field descriptions into the combined gateway schema.

## 7.0.8

### Patch Changes

- cd5da458: fix(stitch): type merging for nested root types

  Because root types do not usually require selectionSets, a nested root type proxied to a remote service may end up having an empty selectionSet, if the nested root types only includes fields from a different subservice.

  Empty selection sets return null, but, in this case, it should return an empty object. We can force this behavior by including the \_\_typename field which exists on every schema.

  Addresses #2347.

  In the future, we may want to include short-circuiting behavior that when delegating to composite fields, if an empty selection set is included, an empty object is returned rather than null. This short-circuiting behavior would be complex for lists, as it would be unclear the length of the list...

- cd5da458: fix(delegate): resolve external values only once

  Because items in a list may be identical and the defaultMergedResolver mutates those objects when resolving them as external values, a check is required so that the mutation happens only once.

  Partially addresses #2304

- Updated dependencies [cd5da458]
  - @graphql-tools/utils@7.1.6

## 7.0.7

### Patch Changes

- 1b730f80: fix(typeMerging): enable subschemas to use keys that have been renamed via transforms
- 29ead57c: fix(batch-delegate): proxy batched errors

## 7.0.6

### Patch Changes

- d40c0a84: fix(delegate): add selectionSets prior to expanding abstract types

## 7.0.5

### Patch Changes

- e50f80a3: enhance(stitch): custom merge resolvers

## 7.0.4

### Patch Changes

- 83b8e428: fix(delegate): import AggregateError polyfill (#2196)

## 7.0.3

### Patch Changes

- 856e23fa: fix(delegate): WrapConcreteTypes should not process fragments that are not on a root type (#2173)
- Updated dependencies [e3176633]
  - @graphql-tools/utils@7.0.2

## 7.0.2

### Patch Changes

- 718eda30: fix(stitch): fix mergeExternalObject regressions

  v7 introduced a regression in the merging of ExternalObjects that causes type merging to fail when undergoing multiple rounds of merging.

## 7.0.1

### Patch Changes

- 294dedda: fix(delegate): Fix type error with `arguments` being undefined
- Updated dependencies [8133a907]
- Updated dependencies [2b6c813e]
  - @graphql-tools/utils@7.0.1

## 7.0.0

### Major Changes

- be1a1575: ## Breaking Changes:

  #### Schema Generation and Decoration API (`@graphql-tools/schema`)

  - Resolver validation options should now be set to `error`, `warn` or `ignore` rather than `true` or `false`. In previous versions, some of the validators caused errors to be thrown, while some issued warnings. This changes brings consistency to validator behavior.

  - The `allowResolversNotInSchema` has been renamed to `requireResolversToMatchSchema`, to harmonize the naming convention of all the validators. The default setting of `requireResolversToMatchSchema` is `error`, matching the previous behavior.

  #### Schema Delegation (`delegateToSchema` & `@graphql-tools/delegate`)

  - The `delegateToSchema` return value has matured and been formalized as an `ExternalObject`, in which all errors are integrated into the GraphQL response, preserving their initial path. Those advanced users accessing the result directly will note the change in error handling. This also allows for the deprecation of unnecessary helper functions including `slicedError`, `getErrors`, `getErrorsByPathSegment` functions. Only external errors with missing or invalid paths must still be preserved by annotating the remote object with special properties. The new `getUnpathedErrors` function is therefore necessary for retrieving only these errors. Note also the new `annotateExternalObject` and `mergeExternalObjects` functions, as well as the renaming of `handleResult` to `resolveExternalValue`.

  - Transform types and the `applySchemaTransforms` are now relocated to the `delegate` package; `applyRequestTransforms`/`applyResultTransforms` functions have been deprecated, however, as this functionality has been replaced since v6 by the `Transformer` abstraction.

  - The `transformRequest`/`transformResult` methods are now provided additional `delegationContext` and `transformationContext` arguments -- these were introduced in v6, but previously optional.

  - The `transformSchema` method may wish to create additional delegating resolvers and so it is now provided the `subschemaConfig` and final (non-executable) `transformedSchema` parameters. As in v6, the `transformSchema` is kicked off once to produce the non-executable version, and then, if a wrapping schema is being generated, proxying resolvers are created with access to the (non-executable) initial result. In v7, the individual `transformSchema` methods also get access to the result of the first run, if necessary, they can create additional wrapping schema proxying resolvers.

  - `applySchemaTransforms` parameters have been updated to match and support the `transformSchema` parameters above.

  #### Remote Schemas & Wrapping (`wrapSchema`, `makeRemoteExecutableSchema`, and `@graphql-tools/wrap`)

  - `wrapSchema` and `generateProxyingResolvers` now only take a single options argument with named properties of type `SubschemaConfig`. The previously possible shorthand version with first argument consisting of a `GraphQLSchema` and second argument representing the transforms should be reworked as a `SubschemaConfig` object.

  - Similarly, the `ICreateProxyingResolverOptions` interface that provides the options for the `createProxyingResolver` property of `SubschemaConfig` options has been adjusted. The `schema` property previously could be set to a `GraphQLSchema` or a `SubschemaConfig` object. This property has been removed in favor of a `subschemaConfig` property that will always be a `SubschemaConfig` object. The `transforms` property has been removed; transforms should be included within the `SubschemaConfig` object.`

  - The format of the wrapping schema has solidified. All non-root fields are expected to use identical resolvers, either `defaultMergedResolver` or a custom equivalent, with root fields doing the hard work of proxying. Support for custom merged resolvers throught `createMergedResolver` has been deprecated, as custom merging resolvers conflicts when using stitching's type merging, where resolvers are expected to be identical across subschemas.

  - The `WrapFields` transform's `wrappingResolver` option has been removed, as this complicates multiple wrapping layers, as well as planned functionality to wrap subscription root fields in potentially multiple layers, as the wrapping resolvers may be different in different layers. Modifying resolvers can still be performed by use of an additional transform such as `TransformRootFields` or `TransformObjectFields`.

  - The `ExtendSchema` transform has been removed, as it is conceptually simpler just to use `stitchSchemas` with one subschema.

  - The `ReplaceFieldsWithFragment`, `AddFragmentsByField`, `AddSelectionSetsByField`, and `AddMergedTypeSelectionSets` transforms has been removed, as they are superseded by the `AddSelectionSets` and `VisitSelectionSets` transforms. The `AddSelectionSets` purposely takes parsed SDL rather than strings, to nudge end users to parse these strings at build time (when possible), rather than at runtime. Parsing of selection set strings can be performed using the `parseSelectionSet` function from `@graphql-tools/utils`.

  #### Schema Stitching (`stitchSchemas` & `@graphql-tools/stitch`)

  - `stitchSchemas`'s `mergeTypes` option is now true by default! This causes the `onTypeConflict` option to be ignored by default. To use `onTypeConflict` to select a specific type instead of simply merging, simply set `mergeTypes` to false.

  - `schemas` argument has been deprecated, use `subschemas`, `typeDefs`, or `types`, depending on what you are stitching.

  - When using batch delegation in type merging, the `argsFromKeys` function is now set only via the `argsFromKeys` property. Previously, if `argsFromKeys` was absent, it could be read from `args`.

  - Support for fragment hints has been removed in favor of selection set hints.

  - `stitchSchemas` now processes all `GraphQLSchema` and `SubschemaConfig` subschema input into new `Subschema` objects, handling schema config directives such aso`@computed` as well as generating the final transformed schema, stored as the `transformedSchema` property, if transforms are used. Signatures of the `onTypeConflict`, `fieldConfigMerger`, and `inputFieldConfigMerger` have been updated to include metadata related to the original and transformed subschemas. Note the property name change for `onTypeConflict` from `schema` to `subschema`.

  #### Mocking (`addMocksToSchema` and `@graphql-tools/mock`)

  - Mocks returning objects with fields set as functions are now operating according to upstream graphql-js convention, i.e. these functions take three arguments, `args`, `context`, and `info` with `parent` available as `this` rather than as the first argument.

  #### Other Utilities (`@graphql-tools/utils`)

  - `filterSchema`'s `fieldFilter` will now filter _all_ fields across Object, Interface, and Input types. For the previous Object-only behavior, switch to the `objectFieldFilter` option.
  - Unused `fieldNodes` utility functions have been removed.
  - Unused `typeContainsSelectionSet` function has been removed, and `typesContainSelectionSet` has been moved to the `stitch` package.
  - Unnecessary `Operation` type has been removed in favor of `OperationTypeNode` from upstream graphql-js.
  - As above, `applySchemaTransforms`/`applyRequestTransforms`/`applyResultTransforms` have been removed from the `utils` package, as they are implemented elsewhere or no longer necessary.

  ## Related Issues

  - proxy all the errors: #1047, #1641
  - better error handling for merges #2016, #2062
  - fix typings #1614
  - disable implicit schema pruning #1817
  - mocks not working for functions #1807

### Patch Changes

- Updated dependencies [be1a1575]
  - @graphql-tools/batch-execute@7.0.0
  - @graphql-tools/schema@7.0.0
  - @graphql-tools/utils@7.0.0

## 6.2.4

### Patch Changes

- 32c3c4f8: enhance(stitching): improve error message for unknown types
- 533d6d53: Bump all packages to allow adjustments
- Updated dependencies [32c3c4f8]
- Updated dependencies [533d6d53]
  - @graphql-tools/utils@6.2.4
  - @graphql-tools/schema@6.2.4
