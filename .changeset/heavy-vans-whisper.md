---
'@graphql-tools/schema': major
---

BREAKING CHANGE

- Remove `logger` and `addErrorLoggingToSchema`
- - You can implement logging and debugging mechanism outside the resolvers using some kind of plugin system based library like [Envelop](https://www.envelop.dev/docs/core#uselogger)
