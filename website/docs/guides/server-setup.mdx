---
id: server-setup
title: Setup an HTTP server
sidebar_label: Setup an HTTP server
---

Here's an example using express-graphql:

```js
const express = require('express');
const { graphqlHTTP } = require('express-graphql');

const typeDefs = require('./graphql/types');
const resolvers = require('./graphql/resolvers');

const { makeExecutableSchema } = require('@graphql-tools/schema');

const schema = makeExecutableSchema({
    typeDefs,
    resolvers,
});

const app = express();
app.use('/graphql', graphqlHTTP({
  schema,
  graphiql: true,
}));

app.listen(3000, () => {
    console.info('Listening on http://localhost:3000/graphql');
});
```

And you can test your queries using built-in [GraphiQL](https://github.com/graphql/graphiql/tree/master/packages/graphiql);

<iframe
  src="https://codesandbox.io/embed/angry-night-e3x06?autoresize=1&fontsize=14&hidenavigation=1&theme=dark"
  style={{width:"100%", height: "500px", "border":0, "borderRadius": "4px", overflow:"hidden"}}
  title="express-graphql-tools-example"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>

## Adding Subscriptions support
[`graphql-ws`](https://github.com/enisdenjo/graphql-ws) offers a server and client implementation for transporting subscription events over WebSockets.

```js
const http = require('http');
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const ws = require('ws'); // yarn add ws
const { useServer } = require('graphql-ws/lib/use/ws');

const typeDefs = require('./graphql/types');
const resolvers = require('./graphql/resolvers');

const { makeExecutableSchema } = require('@graphql-tools/schema');

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

const app = express();
app.use(
  '/graphql',
  graphqlHTTP({
    schema,
    graphiql: true,
  })
);

const server = http.createServer(app);

const wsServer = new ws.Server({
  server,
  path: '/graphql',
});

server.listen(3000, () => {
  useServer({ schema }, wsServer);
  console.info('Listening on http://localhost:3000/graphql');
});
```
