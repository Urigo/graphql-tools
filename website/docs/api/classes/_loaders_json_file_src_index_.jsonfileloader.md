---
id: "_loaders_json_file_src_index_.jsonfileloader"
title: "JsonFileLoader"
sidebar_label: "JsonFileLoader"
---

This loader loads documents and type definitions from JSON files.

The JSON file can be the result of an introspection query made against a schema:

```js
const schema = await loadSchema('schema-introspection.json', {
  loaders: [
    new JsonFileLoader()
  ]
});
```

Or it can be a `DocumentNode` object representing a GraphQL document or type definitions:

```js
const documents = await loadDocuments('queries/*.json', {
  loaders: [
    new GraphQLFileLoader()
  ]
});
```

## Hierarchy

* **JsonFileLoader**

## Implements

* [Loader](/docs/api/interfaces/_utils_src_index_.loader)

## Index

### Methods

* [canLoad](_loaders_json_file_src_index_.jsonfileloader.md#canload)
* [canLoadSync](_loaders_json_file_src_index_.jsonfileloader.md#canloadsync)
* [load](_loaders_json_file_src_index_.jsonfileloader.md#load)
* [loadSync](_loaders_json_file_src_index_.jsonfileloader.md#loadsync)
* [loaderId](_loaders_json_file_src_index_.jsonfileloader.md#loaderid)

## Methods

###  canLoad

▸ **canLoad**(`pointer`: [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle), `options`: [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions)): *Promise‹boolean›*

*Defined in [packages/loaders/json-file/src/index.ts:48](https://github.com/ardatan/graphql-tools/blob/master/packages/loaders/json-file/src/index.ts#L48)*

**Parameters:**

Name | Type |
------ | ------ |
`pointer` | [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle) |
`options` | [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions) |

**Returns:** *Promise‹boolean›*

___

###  canLoadSync

▸ **canLoadSync**(`pointer`: [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle), `options`: [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions)): *boolean*

*Defined in [packages/loaders/json-file/src/index.ts:59](https://github.com/ardatan/graphql-tools/blob/master/packages/loaders/json-file/src/index.ts#L59)*

**Parameters:**

Name | Type |
------ | ------ |
`pointer` | [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle) |
`options` | [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions) |

**Returns:** *boolean*

___

###  load

▸ **load**(`pointer`: [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle), `options`: [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions)): *Promise‹[Source](/docs/api/interfaces/_utils_src_index_.source)›*

*Defined in [packages/loaders/json-file/src/index.ts:71](https://github.com/ardatan/graphql-tools/blob/master/packages/loaders/json-file/src/index.ts#L71)*

**Parameters:**

Name | Type |
------ | ------ |
`pointer` | [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle) |
`options` | [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions) |

**Returns:** *Promise‹[Source](/docs/api/interfaces/_utils_src_index_.source)›*

___

###  loadSync

▸ **loadSync**(`pointer`: [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle), `options`: [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions)): *[Source](/docs/api/interfaces/_utils_src_index_.source)*

*Defined in [packages/loaders/json-file/src/index.ts:82](https://github.com/ardatan/graphql-tools/blob/master/packages/loaders/json-file/src/index.ts#L82)*

**Parameters:**

Name | Type |
------ | ------ |
`pointer` | [SchemaPointerSingle](../modules/_utils_src_index_.md#schemapointersingle) |
`options` | [JsonFileLoaderOptions](/docs/api/interfaces/_loaders_json_file_src_index_.jsonfileloaderoptions) |

**Returns:** *[Source](/docs/api/interfaces/_utils_src_index_.source)*

___

###  loaderId

▸ **loaderId**(): *string*

*Implementation of [Loader](/docs/api/interfaces/_utils_src_index_.loader)*

*Defined in [packages/loaders/json-file/src/index.ts:44](https://github.com/ardatan/graphql-tools/blob/master/packages/loaders/json-file/src/index.ts#L44)*

**Returns:** *string*
