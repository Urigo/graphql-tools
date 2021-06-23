# GraphQL Jest Transform

A Jest transformer to preprocess GraphQL Documents (operations, fragments and SDL)

    yarn add @graphql-tools/jest-transform

In your `package.json`:

```json
{
  "jest": {
    "transform": {
      "\\.(gql|graphql)$": "@graphql-tools/jest-transform"
    }
  }
}
```

or `jest.config.js`:

```javascript
module.exports = {
  // ...
  transform: {
    '\\.(gql|graphql)$': '@graphql-tools/jest-transform',
  },
};
```

> How is it different from `jest-transform-graphql`? It doesn't use `graphql-tag/loader` under the hood but our own, more optimized and customisable `@graphql-tools/webpack-loader`.

## Options

- noDescription (_default: false_) - removes descriptions
- esModule (_default: false_) - uses import and export statements instead of CommonJS

```json
{
  "globals": {
    "graphql": {
      "noDescription": true
    }
  }
}
```
