---
'@graphql-tools/delegate': major
---

BREAKING CHANGE
- Remove `rootValue` from subschemaConfig
- - Pass it through `ExecutionParams` or delegation options
- Do not pass `info.rootValue` if `rootValue` is falsy
