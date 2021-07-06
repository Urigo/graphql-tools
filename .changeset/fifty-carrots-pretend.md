---
'@graphql-tools/url-loader': major
---

BREAKING CHANGE
- Remove `handleSDLAsync` and `handleSDLSync`; use `handleSDL` instead
- Remove `useSSEForSubscription` and `useWebSocketLegacyProtocol`; use `subscriptionProtocol` instead
- If introspection source is different than endpoint, use `endpoint` for remote execution source
- Default HTTP Executor is renamed to `buildHTTPExecutor` with a new signature
- `build*Subscriber` methods are renamed to `buildWSLegacyExecutor`, `buildWSExecutor` and `buildSSEExecutor` with new signatures
- `getFetch` no longer takes `async` flag
