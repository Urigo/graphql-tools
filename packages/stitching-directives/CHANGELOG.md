# @graphql-tools/stitching-directives

## 2.0.0

### Major Changes

- 74581cf3: fix(getDirectives): preserve order around repeatable directives

  BREAKING CHANGE: getDirectives now always return an array of individual DirectiveAnnotation objects consisting of `name` and `args` properties.

  New useful function `getDirective` returns an array of objects representing any args for each use of a single directive (returning the empty object `{}` when a directive is used without arguments).

  Note: The `getDirective` function returns an array even when the specified directive is non-repeatable. This is because one use of this function is to throw an error if more than one directive annotation is used for a non repeatable directive!

  When specifying directives in extensions, one can use either the old or new format.

### Minor Changes

- 70cd65eb: feat(stitching-directives): move federation-to-stitching-sdl

### Patch Changes

- Updated dependencies [af9a78de]
- Updated dependencies [7d3e3006]
- Updated dependencies [9c26b847]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [dae6dc7b]
- Updated dependencies [6877b913]
- Updated dependencies [c42e811d]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [aa43054d]
- Updated dependencies [7d3e3006]
- Updated dependencies [74581cf3]
- Updated dependencies [c0ca3190]
- Updated dependencies [982c8f53]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
  - @graphql-tools/utils@8.0.0
  - @graphql-tools/delegate@8.0.0

## 1.3.3

### Patch Changes

- 5f5436fc: Fix stitching-directives to allow using 'argsExpr' with multiple arguments

## 1.3.2

### Patch Changes

- 2c4db53d: fix(stitching-directives): allow selectionSets to include variably nested lists

## 1.3.1

### Patch Changes

- d7b4e09e: fix(stitching-directives): to allow keys to include lists

## 1.3.0

### Minor Changes

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

### Patch Changes

- Updated dependencies [24926654]
  - @graphql-tools/delegate@7.0.10

## 1.2.0

### Minor Changes

- d9b82a2e: enhance(stitch) canonical merged type and field definitions. Use the @canonical directive to promote preferred type and field descriptions into the combined gateway schema.

### Patch Changes

- Updated dependencies [d9b82a2e]
- Updated dependencies [d9b82a2e]
  - @graphql-tools/delegate@7.0.9

## 1.1.2

### Patch Changes

- 6e50d9fc: enhance(stitching-directives): use keyField

  When using simple keys, i.e. when using the keyField argument to `@merge`, the keyField can be added implicitly to the types's key. In most cases, therefore, `@key` should not be required at all.

- Updated dependencies [6e50d9fc]
  - @graphql-tools/utils@7.2.4

## 1.1.1

### Patch Changes

- 394c4775: fix(stitching-directives): fix abstract types

## 1.1.0

### Minor Changes

- c3996f60: enhance(utils): support code-first schemas by allowing directives to be read from extensions

### Patch Changes

- c3996f60: fix(stitchingDirectives): complete support for code first schemas
- c3996f60: fix(stitchingDirectives): fix name clash

  export all stitching directives as `allDirectives` instead of `stitchingDirectives as the main package function is`stitchingDirectives`

- Updated dependencies [c3996f60]
- Updated dependencies [c3996f60]
- Updated dependencies [c3996f60]
- Updated dependencies [c3996f60]
  - @graphql-tools/utils@7.2.0

## 1.0.0

### Major Changes

- 21da6904: fix release

### Patch Changes

- Updated dependencies [21da6904]
  - @graphql-tools/utils@7.1.2

## 0.0.1

### Patch Changes

- b48a91b1: add ability to specify merge config within subschemas using directives
- Updated dependencies [b48a91b1]
  - @graphql-tools/utils@7.1.1
