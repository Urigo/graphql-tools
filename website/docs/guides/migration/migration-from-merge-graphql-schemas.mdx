---
id: migration-from-merge-graphql-schemas
title: Migration from Merge GraphQL Schemas
sidebar_label: From Merge GraphQL Schemas
description: Migration from Merge GraphQL Schemas
---

Merge GraphQL Schemas was using GraphQL Toolkit's `@graphql-toolkit/schema-merging` package under the hood but we decided to deprecate it in favor of new GraphQL Tools's `@graphql-tools/merge` package and you need to update your project.

## Merging Type Definitions
Instead of `mergeTypes`, you need to use `mergeTypeDefs` from `@graphql-tools/merge` package. The API is almost same except `schemaDefinition` option.

We were using the following implementation to proxy `mergeTypes` to `mergeTypeDefs` of GraphQL Toolkit.
```ts
import { mergeTypeDefs } from '@graphql-toolkit/schema-merging';

type Config = Parameters<typeof mergeTypeDefs>[1];

export const mergeTypes = (types: any[], options?: { schemaDefinition?: boolean, all?: boolean } & Partial<Config>) => {
  const schemaDefinition = options && typeof options.schemaDefinition === 'boolean'
    ? options.schemaDefinition
    : true;

  return mergeTypeDefs(types, {
    useSchemaDefinition: schemaDefinition,
    forceSchemaDefinition: schemaDefinition,
    throwOnConflict: true,
    commentDescriptions: true,
    reverseDirectives: true,
    ...options,
  });
};
```

So if you want to have exact behavior, you can use the options above. Other than that, the API and behavior are almost same.

```ts
import { mergeTypes, mergeResolvers, fileLoader } from 'merge-graphql-schemas';
```

should become

```ts
import { mergeTypeDefs, mergeResolvers } from '@graphql-tools/merge';
import { loadFilesSync } from '@graphql-tools/load-files';
```

So you can replace `mergeTypes` with `mergeTypeDefs` and `fileLoader` with `loadFilesSync`.
