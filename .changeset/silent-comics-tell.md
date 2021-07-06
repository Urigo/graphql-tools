---
'@graphql-tools/schema': major
---

BREAKING CHANGE

- No longer exports `buildSchemaFromTypeDefinitions`, use `buildSchema` from `graphql-js` instead
- Remove `allowUndefinedResolve` option in `makeExecutableSchema` because GraphQL Schema itself does this checking
