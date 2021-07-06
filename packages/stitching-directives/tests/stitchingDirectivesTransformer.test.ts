/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import { print } from 'graphql';

import { makeExecutableSchema } from '@graphql-tools/schema';
import { parseSelectionSet } from '@graphql-tools/utils';

import { stitchingDirectives } from '../src';

describe('type merging directives', () => {
  const { allStitchingDirectivesTypeDefs, stitchingDirectivesTransformer } = stitchingDirectives();

  test('adds type selection sets', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge?.['User'].selectionSet).toEqual(print(parseSelectionSet('{ id }')));
    expect(transformedSubschemaConfig.merge?.['User'].fieldName).toEqual('_user');
  });

  test('adds type selection sets when returns union', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      union Entity = User

      type Query {
        _entity(key: _Key): Entity @merge
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge?.['User'].selectionSet).toEqual(print(parseSelectionSet('{ id }')));
    expect(transformedSubschemaConfig.merge?.['User'].fieldName).toEqual('_entity');
  });

  test('adds type selection sets when returns interface', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      interface Entity {
        id: ID
      }

      type Query {
        _entity(key: _Key): Entity @merge
      }

      type User implements Entity @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge?.['User'].selectionSet).toEqual(print(parseSelectionSet('{ id }')));
    expect(transformedSubschemaConfig.merge?.['User'].fieldName).toEqual('_entity');
  });

  test('adds type selection sets when returns list', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type User @key(selectionSet: "{ relations { id } }") {
        relationIds: [String!]!
      }

      type Query {
        _user(key: _Key): User @merge
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      relations: [
        {
          id: 2
        },
        {
          id: 3
        }
      ]
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        relations: [
          {
            id: 2
          },
          {
            id: 3
          }
        ]
      },
    });
  });

  test('adds type selection sets when returns multi-layered list', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type User @key(selectionSet: "{ relationSets { id } }") {
        relationIds: [[String!]!]!
      }

      type Query {
        _user(key: _Key): User @merge
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      relationSets: [
        [
          {
            id: 2
          },
          {
            id: 3
          }
        ],
        [
          {
            id: 4
          }
        ]
      ]
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        relationSets: [
          [
            {
              id: 2
            },
            {
              id: 3
            }
          ],
          [
            {
              id: 4
            }
          ]
        ]
      },
    });
  });

  test('adds type selection sets when returns null', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type User @key(selectionSet: "{ nestedField { id } }") {
        nestedId: [String!]!
      }

      type Query {
        _user(key: _Key): User @merge
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult: { nestedField: null } = {
      nestedField: null
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        nestedField: null
      },
    });
  });

  test('adds computed selection sets', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge
      }

      type User {
        id: ID
        name: String @computed(selectionSet: "{ id }")
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge?.['User']?.fields?.['name']?.selectionSet).toEqual(print(parseSelectionSet('{ id }')));
    expect(transformedSubschemaConfig.merge?.['User']?.fields?.['name']?.computed).toEqual(true);
    expect(transformedSubschemaConfig.merge?.['User'].fieldName).toEqual('_user');
  });

  test('adds args function when used without arguments', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
      },
    });
  });

  test('adds args function when used with argsExpr argument using an unqualified key', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge(argsExpr: "key: $key")
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
      },
    });
  });

  test('adds args function when used with argsExpr argument using a fully qualified key', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge(argsExpr: "key: { id: $key.id }")
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
      },
    });
  });

  test('adds args function when used with keyArg argument', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge(keyArg: "key")
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
      },
    });
  });

  test('adds args function when used with nested keyArg argument', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      input UserInput {
        key: _Key
      }

      type Query {
        _user(input: UserInput, scope: String): User @merge(keyArg: "input.key", additionalArgs: """ scope: "full" """)
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      input: {
        key: {
          id: '5',
        },
      },
      scope: 'full',
    });
  });

  test('adds args function when used with keyArg and additionalArgs arguments', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key, scope: String): User @merge(keyArg: "key", additionalArgs: """ scope: "full" """)
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
      },
      scope: 'full',
    });
  });

  test('adds key and args function when @merge is used with keyField argument', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      type Query {
        _user(id: ID): User @merge(keyField: "id")
      }

      type User {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge?.['User'].selectionSet).toEqual(`{\n  id\n}`);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      id: '5',
    });
  });

  test('adds args function when used with key argument', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): User @merge(key: ["id", "outer.inner.firstName:name.firstName"])
      }

      type User @key(selectionSet: "{ id name { firstName } }") {
        id: ID
        email: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const argsFn = transformedSubschemaConfig.merge?.['User'].args!;

    const originalResult = {
      id: '5',
      name: {
        firstName: 'Tester',
      },
    };

    const args = argsFn(originalResult);

    expect(args).toEqual({
      key: {
        id: '5',
        outer: {
          inner: {
            firstName: 'Tester',
          },
        },
      },
    });
  });

  test('adds key and argsFromKeys functions when used without arguments', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): [User] @merge
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const keyFn = transformedSubschemaConfig.merge?.['User'].key!;
    const argsFromKeysFn = transformedSubschemaConfig.merge?.['User'].argsFromKeys!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const key = keyFn(originalResult);
    const args = argsFromKeysFn([key]);

    expect(key).toEqual({
      id: '5',
    });
    expect(args).toEqual({
      key: [{
        id: '5',
      }],
    });
  });

  test('adds key and argsFromKeys functions when used without arguments and returns union', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      union Entity = User

      type Query {
        _entity(key: _Key): [Entity] @merge
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const keyFn = transformedSubschemaConfig.merge?.['User'].key!;
    const argsFromKeysFn = transformedSubschemaConfig.merge?.['User'].argsFromKeys!;

    const originalResult = {
      __typename: 'User',
      id: '5',
      email: 'email@email.com',
    };

    const key = keyFn(originalResult);
    const args = argsFromKeysFn([key]);

    expect(key).toEqual({
      __typename: 'User',
      id: '5',
    });
    expect(args).toEqual({
      key: [{
        __typename: 'User',
        id: '5',
      }],
    });
  });

  test('adds key and argsFromKeys functions when used without arguments and returns interface', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      interface Entity {
        id: ID
      }

      type Query {
        _entity(key: _Key): [Entity] @merge
      }

      type User implements Entity @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const keyFn = transformedSubschemaConfig.merge?.['User'].key!;
    const argsFromKeysFn = transformedSubschemaConfig.merge?.['User'].argsFromKeys!;

    const originalResult = {
      __typename: 'User',
      id: '5',
      email: 'email@email.com',
    };

    const key = keyFn(originalResult);
    const args = argsFromKeysFn([key]);

    expect(key).toEqual({
      __typename: 'User',
      id: '5',
    });
    expect(args).toEqual({
      key: [{
        __typename: 'User',
        id: '5',
      }],
    });
  });

  test('adds key and argsFromKeys functions with argsExpr argument using an unqualified key', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): [User] @merge(argsExpr: "key: [[$key]]")
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const keyFn = transformedSubschemaConfig.merge?.['User'].key!;
    const argsFromKeysFn = transformedSubschemaConfig.merge?.['User'].argsFromKeys!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const key = keyFn(originalResult);
    const args = argsFromKeysFn([key]);

    expect(key).toEqual({
      id: '5',
    });
    expect(args).toEqual({
      key: [{
        id: '5',
      }],
    });
  });

  test('adds key and argsFromKeys functions with argsExpr argument using a fully qualified key', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}
      scalar _Key

      type Query {
        _user(key: _Key): [User] @merge(argsExpr: "key: [[{ id: $key.id }]]")
      }

      type User @key(selectionSet: "{ id }") {
        id: ID
        name: String
      }
    `;

    const schema = makeExecutableSchema({ typeDefs });

    const subschemaConfig = {
      schema,
    }

    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    const keyFn = transformedSubschemaConfig.merge?.['User'].key!;
    const argsFromKeysFn = transformedSubschemaConfig.merge?.['User'].argsFromKeys!;

    const originalResult = {
      id: '5',
      email: 'email@email.com',
    };

    const key = keyFn(originalResult);
    const args = argsFromKeysFn([key]);

    expect(key).toEqual({
      id: '5',
    });
    expect(args).toEqual({
      key: [{
        id: '5',
      }],
    });
  });

  test('applies canonical merge attributions', () => {
    const typeDefs = `
      ${allStitchingDirectivesTypeDefs}

      type User implements IUser @canonical {
        id: ID
        name: String @canonical
      }

      interface IUser @canonical {
        id: ID
        name: String @canonical
      }

      input UserInput @canonical {
        id: ID
        name: String @canonical
      }

      enum UserEnum @canonical {
        VALUE
      }

      union UserUnion @canonical = User

      scalar Key @canonical
    `;

    const schema = makeExecutableSchema({ typeDefs });
    const subschemaConfig = { schema };
    const transformedSubschemaConfig = stitchingDirectivesTransformer(subschemaConfig);

    expect(transformedSubschemaConfig.merge).toEqual({
      User: {
        canonical: true,
        fields: {
          name: { canonical: true },
        }
      },
      IUser: {
        canonical: true,
        fields: {
          name: { canonical: true },
        }
      },
      UserInput: {
        canonical: true,
        fields: {
          name: { canonical: true },
        }
      },
      UserEnum: {
        canonical: true,
      },
      UserUnion: {
        canonical: true,
      },
      Key: {
        canonical: true,
      }
    });
  });
});
