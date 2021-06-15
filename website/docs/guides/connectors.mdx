---
id: connectors
title: Data fetching
description: How to fetch data from your GraphQL resolvers.
---

By this point in the documentation, you know how to generate a GraphQL.js schema from the GraphQL schema language, and how to add resolvers to that schema to call functions. How do you access your backend from those resolvers? Well, it's quite easy, but as your app gets more complex it might make sense to add some structure. We'll start with the basics and then move on to more advanced conventions.

## Basic fetching

As you have read on the [resolvers page](/docs/resolvers/#resolver-result-format), resolvers in GraphQL.js can return Promises. This means it's easy to fetch data using any library that returns a promise for the result:

```js
import { fetch } from 'cross-fetch';

const resolverMap = {
  Query: {
    async gitHubRepository(root, args, context) {
      const response = await fetch(`https://api.github.com/repos/${args.name}`);
      return response.json();
    }
  }
}
```

## Factoring out fetching details

As you start to have more different resolvers that need to access the GitHub API, the above approach becomes unsustainable. It's good to abstract that away into a "repository" pattern. We call these data fetching functions "connectors":

```js
// github-connector.js
import { fetch } from 'cross-fetch';

// This gives you a place to put GitHub API keys, for example
const { GITHUB_API_KEY, GITHUB_API_SECRET } = process.env;

export function getRepositoryByName(name) {
  const response = fetch(`https://api.github.com/repos/${name}?GITHUB_API_KEY=${GITHUB_API_KEY}&GITHUB_API_SECRET=${GITHUB_API_SECRET}`);
}
```

Now, we can use this function in several resolvers:

```js
import { getRepositoryByName } from './github-connector.js';

const resolverMap = {
  Query: {
    gitHubRepository(root, args, context) {
      return getRepositoryByName(args.name);
    }
  },
  Submission: {
    repository(root, args, context) {
      return getRepositoryByName(root.repositoryFullName);
    }
  }
}
```

This means we no longer have to worry about the details of fetching from GitHub inside our resolvers, and we just need to put in the right repository name to fetch. We can improve our GitHub fetching logic over time.

## DataLoader and caching

At some point, you might get to a situation where you are fetching the same objects over and over during the course of a single query. For example, you could have a list of repositories which each want to know about their owner:

```graphql
query {
  repositories(limit: 10) {
    owner {
      login
      avatar_url
    }
  }
}
```

Let's say this is our resolver for `owner`:

```js
import { getAuthorByName } from './github-connector.js';

const resolverMap = {
  Repository: {
    owner(root, args, context) {
      return getAuthorByName(root.owner);
    },
  },
};
```

If the list of repositories has several that were owned by the same user, the `getAuthorByName` function will be called once for each, doing unnecessary requests to the GitHub API, and running down our API limit.

You can improve the situation by adding a per-request cache with `dataloader`, Facebook's [helpful JavaScript library](https://github.com/facebook/dataloader) for in-memory data caching.

### One dataloader per request

One important thing to understand about `dataloader` is that it caches the results forever, unless told otherwise. So we really want to make sure we create a new instance for _every_ request sent to our server, so that we de-duplicate fetches in one query but not across multiple requests or, even worse, multiple users.
