import { buildSchema, parse, GraphQLError } from 'graphql';

import { ExecutionResult } from '@graphql-tools/utils';

import { relocatedError } from '../src/errors';

import { visitResult } from '../src/visitResult';

describe('visiting results', () => {
  const schema = buildSchema(`
    interface TestInterface {
      field: String
    }
    type Test {
      field: String
    }
    type Query {
      test: TestInterface
    }
  `);

  const request = {
    document: parse('{ test { field } }'),
    variables: {},
  };

  it('should visit without throwing', async () => {
    expect(() => visitResult({}, request, schema, undefined)).not.toThrow();
  });

  it('should allow visiting without a resultVisitorMap', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, undefined);
    expect(visitedResult).toEqual(result);
  });

  it('should visit with a request with introspection fields without throwing', async () => {
    const introspectionRequest = {
      document: parse('{ test { field __typename } }'),
      variables: {}
    };
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };
    expect(() => visitResult(result, introspectionRequest, schema, undefined)).not.toThrow();
  });

  it('should successfully modify the result using an object type result visitor', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, {
      Test: {
        field: () => 'success',
      },
    });

    const expectedResult = {
      data: {
        test: {
          __typename: 'Test',
          field: 'success',
        },
      },
    };

    expect(visitedResult).toEqual(expectedResult);
  });

  it('should successfully modify the result using a leaf type result visitor', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, {
      String: () => 'success',
    });

    const expectedResult = {
      data: {
        test: {
          __typename: 'Test',
          field: 'success',
        },
      },
    };

    expect(visitedResult).toEqual(expectedResult);
  });

  it('should successfully modify the result using both leaf type and object type visitors', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, {
      Test: {
        // leaf type visitors fire first.
        field: (value) => value === 'intermediate' ? 'success' : 'failure',
      },
      String: () => 'intermediate',
    });

    const expectedResult = {
      data: {
        test: {
          __typename: 'Test',
          field: 'success',
        },
      },
    };

    expect(visitedResult).toEqual(expectedResult);
  });

  it('should successfully modify the __typename field of an object', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, {
      Test: {
        __typename: () => 'Success',
      },
    });

    const expectedResult = {
      data: {
        test: {
          __typename: 'Success',
          field: 'test',
        },
      },
    };

    expect(visitedResult).toEqual(expectedResult);
  });

  it('should successfully modify the object directly using the __leave field of an object type result visitor', async () => {
    const result = {
      data: {
        test: {
          __typename: 'Test',
          field: 'test',
        },
      },
    };

    const visitedResult = visitResult(result, request, schema, {
      Test: {
        __leave: (object) => ({
          ...object,
          __typename: 'Success',
        }),
      },
    });

    const expectedResult = {
      data: {
        test: {
          __typename: 'Success',
          field: 'test',
        },
      },
    };

    expect(visitedResult).toEqual(expectedResult);
  });
});

describe('visiting nested results', () => {
  const schema = buildSchema(`
    type User {
      name: String
    }
    type UserGroup {
      name: String
      subGroupedUsers: [[User]]
    }
    type Query {
      userGroups: [UserGroup]
    }
  `);

  const request = {
    document: parse(`{
      userGroups {
        name
        subGroupedUsers {
          name
        }
      }
    }`),
    variables: {},
  };

  it('should work', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: [{
          name: 'Group A',
          subGroupedUsers: [[
            {
              name: 'User A',
            }
          ]]
        }],
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });

  it('should work when the parent is null', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: null,
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });

  it('should work when the parent is an empty list', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: [],
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });
});

describe('visiting nested results', () => {
  const schema = buildSchema(`
    type User {
      name: String
    }
    type UserGroup {
      name: String
      subGroupedUsers: [[User]]
    }
    type Query {
      userGroups: [UserGroup]
    }
  `);

  const request = {
    document: parse(`{
      userGroups {
        name
        subGroupedUsers {
          name
        }
      }
    }`),
    variables: {},
  };

  it('should work', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: [{
          name: 'Group A',
          subGroupedUsers: [[
            {
              name: 'User A',
            }
          ]]
        }],
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });

  it('should work when the parent is null', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: null,
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });

  it('should work when the parent is an empty list', async () => {
    const result: ExecutionResult = {
      data: {
        userGroups: [],
      },
    };

    const visitedResult = visitResult(result, request, schema, {});
    expect(visitedResult).toEqual(result);
  });
});

describe('visiting errors', () => {
  const schema = buildSchema(`
    interface TestInterface {
      field: String
    }
    type Test {
      field: String
    }
    type Query {
      test: TestInterface
    }
  `);

  const request = {
    document: parse('{ test { field } }'),
    variables: {},
  };

  it('should allow visiting without an errorVisitor', async () => {
    const result: ExecutionResult = {
      data: {
        test: {
          __typename: 'Test',
          field: null,
        },
      },
      errors: [
        new GraphQLError('unpathed error'),
        new GraphQLError('pathed error', undefined, undefined, undefined, ['test', 'field']),
      ]
    };

    const visitedResult = visitResult(result, request, schema, undefined, undefined);
    expect(visitedResult).toEqual(result);
  });

  it('should allow visiting with an errorVisitorMap', async () => {
    const result: ExecutionResult = {
      data: {
        test: {
          __typename: 'Test',
          field: null,
        },
      },
      errors: [
        new GraphQLError('unpathed error'),
        new GraphQLError('pathed error', undefined, undefined, undefined, ['test', 'field']),
      ]
    };

    const visitedResult = visitResult(result, request, schema, undefined, {
      Query: {
        test: (error, pathIndex) => {
          const oldPath = error.path ?? [];
          const newPath = [...oldPath.slice(0, pathIndex), 'inserted', ...oldPath.slice(pathIndex)];
          return relocatedError(error, newPath);
        },
      },
    });

    expect(visitedResult.errors[1].path).toEqual(['test', 'inserted', 'field']);
  });
});
