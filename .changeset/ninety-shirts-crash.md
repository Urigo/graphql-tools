---
'@graphql-tools/utils': major
---

BREAKING CHANGE

- No longer exports `debugLog` but uses `console.log` directly only if `DEBUG` is available under `process.env`
