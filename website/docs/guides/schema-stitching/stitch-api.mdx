---
id: stitch-api
title: Stitching API
description: Stitching API
---

### stitchSchemas

This is the main function that implements schema stitching. It accepts all the same arguments as [`makeExecutableSchema`](/docs/generate-schema/), and the additions below.

```ts
import { stitchSchemas } from '@graphql-tools/stitch';

stitchSchemas({
  subschemas?: Array<GraphQLSchema | SubschemaConfig | Array<SubschemaConfig>>;
  types?: Array<GraphQLNamedType>;
  typeDefs?: ITypeDefinitions;
  resolvers?: IResolvers<any, TContext> | Array<IResolvers<any, TContext>>;
  mergeDirectives?: boolean;
  mergeTypes?: boolean | Array<string> | MergeTypeFilter;
  typeMergingOptions?: TypeMergingOptions;
  onTypeConflict?: OnTypeConflict;
  subschemaConfigTransforms?: Array<SubschemaConfigTransform>;
}): GraphQLSchema

export interface TypeMergingOptions {
  typeDescriptionsMerger?: (candidates: Array<MergeTypeCandidate>) => string;
  fieldConfigMerger?: (candidates: Array<MergeFieldConfigCandidate>) => GraphQLFieldConfig<any, any>;
  inputFieldConfigMerger?: (candidates: Array<MergeInputFieldConfigCandidate>) => GraphQLInputFieldConfig;
}

export type OnTypeConflict = (
  left: GraphQLNamedType,
  right: GraphQLNamedType,
  info?: {
    left: {
      subschema?: GraphQLSchema | SubschemaConfig;
      transformedSubschema?: Subschema;
    };
    right: {
      subschema?: GraphQLSchema | SubschemaConfig;
      transformedSubschema?: Subschema;
    };
  }
) => GraphQLNamedType;
```

- `subschemas`: an array of schema-like objects. These subschemas are wrapped with proxying resolvers in the final schema.
- `types`: additional types to add to the final type map, most useful for custom scalars or enums.
- `typeDefs`: strings or parsed documents that contain additional types or type extensions. Type extensions are always applied last.
- `resolvers`: accepts [standard resolvers](/docs/resolvers/) with the addition of specifying a [`selectionSet`](/docs/stitch-schema-extensions#selectionset).
- `mergeTypes`: specifies a strategy for [handling duplicated types](/docs/stitch-combining-schemas#duplicate-types).
- `typeMergingOptions`: allows customization of [automatic type merging](/docs/stitch-combining-schemas#automatic-merge).
- `onTypeConflict`: allows customization of [manual type resolution](/docs/stitch-combining-schemas#manual-resolution).

### createMergedTypeResolver

Creates a merged type resolver that may be [wrapped with custom behaviors](/docs/stitch-type-merging#wrapped-resolvers).

```ts
import { createMergedTypeResolver } from '@graphql-tools/stitch';

createMergedTypeResolver({
  fieldName?: string;
  args?: (originalResult: any) => Record<string, any>;
  argsFromKeys?: (keys: ReadonlyArray<K>) => Record<string, any>;
  valuesFromResults?: (results: any, keys: ReadonlyArray<K>) => Array<V>;
}): MergedTypeResolver
```

### forwardArgsToSelectionSet

Creates a dynamic `selectionSet` that [forwards gateway arguments](/docs/stitch-schema-extensions#via-selectionset) to a resolver selection hint.

```ts
import { forwardArgsToSelectionSet } from '@graphql-tools/stitch';

forwardArgsToSelectionSet(
  selectionSet: string,
  mapping?: Record<string, string[]>
) => (field: FieldNode) => SelectionSetNode
```
