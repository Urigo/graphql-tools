---
'@graphql-tools/delegate': major
'@graphql-tools/apollo-engine-loader': major
'@graphql-tools/utils': major
'@graphql-tools/wrap': major
---

BREAKING CHANGE

- Now it uses the native [`AggregateError`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AggregateError) implementation. The major difference is the individual errors are kept under `errors` property instead of the object itself with `Symbol.iterator`.

```js
// From;
for (const error of aggregateError)
// To;
for (const error of aggregateError.errors)
```
