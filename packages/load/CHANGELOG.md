# @graphql-tools/load

## 7.0.0

### Major Changes

- af9a78de: BREAKING CHANGE

  - Now each loader handles glob patterns internally and returns an array of `Source` object instead of single `Source`

  - GraphQL Tag Pluck now respects code locations and returns graphql-js `Source` objects for each found code block

  - Thanks to the one above, `CodeFileLoader` now returns different `Source` objects for each found SDL code block.

### Patch Changes

- c5342de7: Loader.canLoad and Loader.canLoadSync can only handle file paths not glob patterns
- Updated dependencies [af9a78de]
- Updated dependencies [9c26b847]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [dae6dc7b]
- Updated dependencies [6877b913]
- Updated dependencies [c42e811d]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [7d3e3006]
- Updated dependencies [74581cf3]
- Updated dependencies [c0ca3190]
- Updated dependencies [982c8f53]
- Updated dependencies [7d3e3006]
- Updated dependencies [a31f9593]
- Updated dependencies [7d3e3006]
  - @graphql-tools/utils@8.0.0
  - @graphql-tools/merge@6.2.15

## 6.2.8

### Patch Changes

- 68946667: fix(merge): fix handling schema definitions with convertExtensions flag
- Updated dependencies [68946667]
  - @graphql-tools/merge@6.2.12

## 6.2.7

### Patch Changes

- 219ed392: enhance(load/module-loader/merge): use getDocumentNodeFromSchema instead of parse and printSchemaWithDirectives together
- Updated dependencies [219ed392]
- Updated dependencies [219ed392]
- Updated dependencies [219ed392]
- Updated dependencies [219ed392]
  - @graphql-tools/utils@7.5.0
  - @graphql-tools/merge@6.2.9

## 6.2.6

### Patch Changes

- 8f331aaa: enhance(load/module-loader/merge): use getDocumentNodeFromSchema instead of parse and printSchemaWithDirectives together
- Updated dependencies [8f331aaa]
- Updated dependencies [8f331aaa]
- Updated dependencies [8f331aaa]
  - @graphql-tools/utils@7.4.0
  - @graphql-tools/merge@6.2.8

## 6.2.5

### Patch Changes

- Updated dependencies [be1a1575]
  - @graphql-tools/utils@7.0.0
  - @graphql-tools/merge@6.2.5

## 6.2.4

### Patch Changes

- 533d6d53: Bump all packages to allow adjustments
- Updated dependencies [32c3c4f8]
- Updated dependencies [32c3c4f8]
- Updated dependencies [533d6d53]
  - @graphql-tools/merge@6.2.4
  - @graphql-tools/utils@6.2.4
