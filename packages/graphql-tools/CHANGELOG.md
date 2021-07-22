# graphql-tools

## 8.0.0

### Major Changes

- 7d3e3006: BREAKING CHANGE
  - Now it only exports `makeExecutableSchema` from `@graphql-tools/schema`
  - Please migrate to scoped packages(`@graphql-tools/*`) because this npm package will no longer get updated

### Patch Changes

- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
  - @graphql-tools/schema@8.0.0

## 7.0.5

### Patch Changes

- 52971f4e: fix(graphql-tools): provide @apollo/client as an optional package
- Updated dependencies [eae28793]
  - @graphql-tools/merge@6.2.14

## 7.0.4

### Patch Changes

- Revert mock package to v7 to avoid breaking changes

## 7.0.3

### Patch Changes

- Updated dependencies [24926654]
- Updated dependencies [24926654]
- Updated dependencies [24926654]
  - @graphql-tools/delegate@7.0.10
  - @graphql-tools/stitch@7.3.0
  - @graphql-tools/links@7.0.4
  - @graphql-tools/mock@8.0.0

## 7.0.2

### Patch Changes

- fb14cd28: Added export from new optimize package
- Updated dependencies [fb14cd28]
  - @graphql-tools/optimize@1.0.1

## 7.0.1

### Patch Changes

- Updated dependencies [294dedda]
- Updated dependencies [294dedda]
- Updated dependencies [2b6c813e]
- Updated dependencies [8133a907]
- Updated dependencies [2b6c813e]
  - @graphql-tools/delegate@7.0.1
  - @graphql-tools/url-loader@6.3.2
  - @graphql-tools/links@7.0.0
  - @graphql-tools/utils@7.0.1

## 7.0.0

### Major Changes

- a9254491: - Resolver validation options should now be set to `error`, `warn` or `ignore` rather than `true` or `false`. In previous versions, some of the validators caused errors to be thrown, while some issued warnings. This changes brings consistency to validator behavior.

  - The `allowResolversNotInSchema` has been renamed to `requireResolversToMatchSchema`, to harmonize the naming convention of all the validators. The default setting of `requireResolversToMatchSchema` is `error`, matching the previous behavior.

  * The `delegateToSchema` return value has matured and been formalized as an `ExternalObject`, in which all errors are integrated into the GraphQL response, preserving their initial path. Those advanced users accessing the result directly will note the change in error handling. This also allows for the deprecation of unnecessary helper functions including `slicedError`, `getErrors`, `getErrorsByPathSegment` functions. Only external errors with missing or invalid paths must still be preserved by annotating the remote object with special properties. The new `getUnpathedErrors` function is therefore necessary for retrieving only these errors. Note also the new `annotateExternalObject` and `mergeExternalObjects` functions, as well as the renaming of `handleResult` to `resolveExternalValue`.

  * Transform types and the `applySchemaTransforms` are now relocated to the `delegate` package; `applyRequestTransforms`/`applyResultTransforms` functions have been deprecated, however, as this functionality has been replaced since v6 by the `Transformer` abstraction.

  * The `transformRequest`/`transformResult` methods are now provided additional `delegationContext` and `transformationContext` arguments -- these were introduced in v6, but previously optional.

  * The `transformSchema` method may wish to create additional delegating resolvers and so it is now provided the `subschemaConfig` and final (non-executable) `transformedSchema` parameters. As in v6, the `transformSchema` is kicked off once to produce the non-executable version, and then, if a wrapping schema is being generated, proxying resolvers are created with access to the (non-executable) initial result. In v7, the individual `transformSchema` methods also get access to the result of the first run, if necessary, they can create additional wrapping schema proxying resolvers.

  * `applySchemaTransforms` parameters have been updated to match and support the `transformSchema` parameters above.

  - `wrapSchema` and `generateProxyingResolvers` now only take a single options argument with named properties of type `SubschemaConfig`. The previously possible shorthand version with first argument consisting of a `GraphQLSchema` and second argument representing the transforms should be reworked as a `SubschemaConfig` object.

  - Similarly, the `ICreateProxyingResolverOptions` interface that provides the options for the `createProxyingResolver` property of `SubschemaConfig` options has been adjusted. The `schema` property previously could be set to a `GraphQLSchema` or a `SubschemaConfig` object. This property has been removed in favor of a `subschemaConfig` property that will always be a `SubschemaConfig` object. The `transforms` property has been removed; transforms should be included within the `SubschemaConfig` object.`

  - The format of the wrapping schema has solidified. All non-root fields are expected to use identical resolvers, either `defaultMergedResolver` or a custom equivalent, with root fields doing the hard work of proxying. Support for custom merged resolvers throught `createMergedResolver` has been deprecated, as custom merging resolvers conflicts when using stitching's type merging, where resolvers are expected to be identical across subschemas.

  - The `WrapFields` transform's `wrappingResolver` option has been removed, as this complicates multiple wrapping layers, as well as planned functionality to wrap subscription root fields in potentially multiple layers, as the wrapping resolvers may be different in different layers. Modifying resolvers can still be performed by use of an additional transform such as `TransformRootFields` or `TransformObjectFields`.

  - The `ExtendSchema` transform has been removed, as it is conceptually simpler just to use `stitchSchemas` with one subschema.

  - The `ReplaceFieldsWithFragment`, `AddFragmentsByField`, `AddSelectionSetsByField`, and `AddMergedTypeSelectionSets` transforms has been removed, as they are superseded by the `AddSelectionSets` and `VisitSelectionSets` transforms. The `AddSelectionSets` purposely takes parsed SDL rather than strings, to nudge end users to parse these strings at build time (when possible), rather than at runtime. Parsing of selection set strings can be performed using the `parseSelectionSet` function from `@graphql-tools/utils`.

  * `stitchSchemas`'s `mergeTypes` option is now true by default! This causes the `onTypeConflict` option to be ignored by default. To use `onTypeConflict` to select a specific type instead of simply merging, simply set `mergeTypes` to false.

  * `schemas` argument has been deprecated, use `subschemas`, `typeDefs`, or `types`, depending on what you are stitching.

  * When using batch delegation in type merging, the `argsFromKeys` function is now set only via the `argsFromKeys` property. Previously, if `argsFromKeys` was absent, it could be read from `args`.

  * Support for fragment hints has been removed in favor of selection set hints.

  * `stitchSchemas` now processes all `GraphQLSchema` and `SubschemaConfig` subschema input into new `Subschema` objects, handling schema config directives such aso`@computed` as well as generating the final transformed schema, stored as the `transformedSchema` property, if transforms are used. Signatures of the `onTypeConflict`, `fieldConfigMerger`, and `inputFieldConfigMerger` have been updated to include metadata related to the original and transformed subschemas. Note the property name change for `onTypeConflict` from `schema` to `subschema`.

  - Mocks returning objects with fields set as functions are now operating according to upstream graphql-js convention, i.e. these functions take three arguments, `args`, `context`, and `info` with `parent` available as `this` rather than as the first argument.

  * `filterSchema`'s `fieldFilter` will now filter _all_ fields across Object, Interface, and Input types. For the previous Object-only behavior, switch to the `objectFieldFilter` option.
  * Unused `fieldNodes` utility functions have been removed.
  * Unused `typeContainsSelectionSet` function has been removed, and `typesContainSelectionSet` has been moved to the `stitch` package.
  * Unnecessary `Operation` type has been removed in favor of `OperationTypeNode` from upstream graphql-js.
  * As above, `applySchemaTransforms`/`applyRequestTransforms`/`applyResultTransforms` have been removed from the `utils` package, as they are implemented elsewhere or no longer necessary.

### Patch Changes

- Updated dependencies [a9254491]
  - @graphql-tools/batch-delegate@7.0.0
  - @graphql-tools/stitch@7.0.1

## 6.2.6

### Patch Changes

- 96a7555d: Fix release

  Last PATCH release actually transitively updated graphql-tools and @graphql-tools/delegate to use latest MAJOR version of dependencies.

- Updated dependencies [96a7555d]
  - @graphql-tools/batch-delegate@6.2.6

## 6.2.5

### Patch Changes

- Updated dependencies [be1a1575]
  - @graphql-tools/batch-execute@7.0.0
  - @graphql-tools/delegate@7.0.0
  - @graphql-tools/mock@7.0.0
  - @graphql-tools/schema@7.0.0
  - @graphql-tools/stitch@7.0.0
  - @graphql-tools/utils@7.0.0
  - @graphql-tools/wrap@7.0.0
  - @graphql-tools/links@6.2.5
  - @graphql-tools/merge@6.2.5
  - @graphql-tools/batch-delegate@6.2.5
  - @graphql-tools/url-loader@6.3.1
  - @graphql-tools/graphql-tag-pluck@6.2.6
  - @graphql-tools/load@6.2.5
  - @graphql-tools/code-file-loader@6.2.5
  - @graphql-tools/git-loader@6.2.5
  - @graphql-tools/github-loader@6.2.5
  - @graphql-tools/graphql-file-loader@6.2.5
  - @graphql-tools/json-file-loader@6.2.5
  - @graphql-tools/module-loader@6.2.5
  - @graphql-tools/relay-operation-optimizer@6.2.5
  - @graphql-tools/resolvers-composition@6.2.5

## 6.2.4

### Patch Changes

- 533d6d53: Bump all packages to allow adjustments
- Updated dependencies [32c3c4f8]
- Updated dependencies [32c3c4f8]
- Updated dependencies [32c3c4f8]
- Updated dependencies [32c3c4f8]
- Updated dependencies [32c3c4f8]
- Updated dependencies [533d6d53]
  - @graphql-tools/stitch@6.2.4
  - @graphql-tools/wrap@6.2.4
  - @graphql-tools/import@6.2.4
  - @graphql-tools/merge@6.2.4
  - @graphql-tools/utils@6.2.4
  - @graphql-tools/delegate@6.2.4
  - @graphql-tools/batch-delegate@6.2.4
  - @graphql-tools/graphql-tag-pluck@6.2.4
  - @graphql-tools/links@6.2.4
  - @graphql-tools/load@6.2.4
  - @graphql-tools/code-file-loader@6.2.4
  - @graphql-tools/git-loader@6.2.4
  - @graphql-tools/github-loader@6.2.4
  - @graphql-tools/graphql-file-loader@6.2.4
  - @graphql-tools/json-file-loader@6.2.4
  - @graphql-tools/module-loader@6.2.4
  - @graphql-tools/url-loader@6.2.4
  - @graphql-tools/mock@6.2.4
  - @graphql-tools/relay-operation-optimizer@6.2.4
  - @graphql-tools/resolvers-composition@6.2.4
  - @graphql-tools/schema@6.2.4
  - @graphql-tools/load-files@6.2.4
