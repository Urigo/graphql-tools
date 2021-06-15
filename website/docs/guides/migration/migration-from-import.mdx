---
id: migration-from-import
title: Migration from GraphQL Import
sidebar_label: From GraphQL Import
description: Migration from GraphQL Import
---

GraphQL Import was an NPM package that allows you import and export definitions using `#import` syntax in `.graphql` files. So this package has been moved under GraphQL Tools monorepo. It is really easy to migrate. You need two different packages `@graphql-tools/load` and `@graphql-tools/graphql-file-loader`.

Before;
```ts
import { importSchema } from 'graphql-import';
import { makeExecutableSchema } from 'graphql-tools';
import { join } from 'path';

const typeDefs = importSchema(join(__dirname, 'schema.graphql'));
const resolvers = {
  Query: {/**...*/}
};
const schema = makeExecutableSchema({ typeDefs, resolvers });
```

After;
```ts
import { loadSchemaSync } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { addResolversToSchema } from '@graphql-tools/schema';
import { join } from 'path';

const schema = loadSchemaSync(join(__dirname, 'schema.graphql'), { loaders: [new GraphQLFileLoader()] });
const resolvers = { Query: {/**...*/} };

const schemaWithResolvers = addResolversToSchema({
  schema,
  resolvers,
});
```

You can learn more about those new packages in [Schema Loading](/docs/schema-loading) section.

