---
'@graphql-tools/batch-execute': major
'@graphql-tools/delegate': major
'@graphql-tools/links': major
'@graphql-tools/url-loader': major
'@graphql-tools/stitch': major
'@graphql-tools/utils': major
'@graphql-tools/wrap': major
---

BREAKING CHANGE
- Remove Subscriber and use only Executor
- - Now `Executor` can receive `AsyncIterable` and subscriptions will also be handled by `Executor`. This is a future-proof change for defer, stream and live queries


